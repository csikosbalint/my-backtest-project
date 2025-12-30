import YahooFinance from 'yahoo-finance2'
import { calculateSharpeRatio } from '@railpath/finance-toolkit';
import Fred from './fred.js';
import { closestDate, dateDiff, isSameDay } from "./tools.js";
import fs from 'fs';
import { stdout } from 'process';
const fred = new Fred(process.env.FRED_API_KEY);
const TB3MS = await fred.getData('TB3MS')

const tickers = ['GLD', 'SPY', 'TLT']
const tickersAndCash = [...tickers, 'SHY']
const period = {
    period1: '2000-01-01',
    period2: '2025-12-30',
    interval: '1d'
}
const yahooFinance = new YahooFinance()
const data = {}
// iterate over ticker symbols and fetch data
await Promise.all(tickersAndCash.map(ticker => yahooFinance.chart(ticker, period)))
    .then(values => {
        values.forEach((value, index) => {
            data[value.meta.symbol] = value
        })
    })
// find the shortest data length
const allTickersDayLength = Math.min(...Object.values(data).map(d => d.quotes.length))
// go day by day: first day is allTickersDayLength ago (last in quotes array - allTickersDayLength), last is today (last in quotes array - 1)
// every day calculate returns for each ticker, add them to quotes as return property
tickers.forEach(ticker => {
    const quotes = data[ticker].quotes
    const startIndex = quotes.length - allTickersDayLength
    for (let i = startIndex; i < quotes.length; i++) {
        if (i === 0) {
            quotes[i].return = 0 // no return for first day
        } else {
            const prevClose = quotes[i - 1].close
            const currClose = quotes[i].close
            quotes[i].return = ((currClose - prevClose) / prevClose) * 100 // return in percentage
        }
    }
})
// for each ticker, get returns array and calculate sharpe ratio
const annualizationFactor = 252 // daily returns annualization factor
const parameter = 252
// calculate sharpe ratio for each ticker, startin from minLength days ago
// and use parameter as moving return window
tickers.forEach(ticker => {
    const quotes = data[ticker].quotes
    const startIndex = quotes.length - allTickersDayLength
    const returns = []
    for (let i = startIndex; i < quotes.length; i++) { // collect returns for the last allTickersDayLength days
        returns.push({ return: quotes[i].return, date: quotes[i].date })
    }
    for (let i = parameter; i <= returns.length; i++) { // calculate sharpe ratio for each window (parameter days)
        const returnWindow = returns.slice(i - parameter, i)
        const closestDateInTB3MS = closestDate(new Date(returnWindow[returnWindow.length - 1].date), TB3MS.map(d => new Date(d.date)))
        const riskFreeRate = TB3MS.find(d => isSameDay(new Date(d.date), new Date(closestDateInTB3MS))).value / 100 // convert percentage to decimal
        const { sharpeRatio } = calculateSharpeRatio({ returns: returnWindow.map(r => r.return), riskFreeRate, annualizationFactor })
        quotes[startIndex + i - 1].sharpeRatio = sharpeRatio
    }
})
// start with allTickersDayLength days ago for each ticker,
// select the ticker with the highest sharpe ratio for that day
// add the ticker to invested array
// output file sould look like:
// Start Date,EEM,EFA,RWR,GLD,IWB,DBC,TLT,SHY,IWM
// 01/01/2007,33.33%,33.33%,33.33%,,,,,,
const output = fs.createWriteStream('sharpe_output.csv')
output.write('Start Date,' + tickersAndCash.join(',') + '\n')
const cooldownPeriod = 252 // days to wait before switching tickers
const lastInvested = {
    ticker: undefined,
    date: undefined
}
tickers.forEach(ticker => {
    const quotes = data[ticker].quotes
    for (let i = quotes.length - allTickersDayLength; i < quotes.length; i++) {
        const date = new Date(quotes[i].date)
        if (lastInvested.ticker && lastInvested.date) {
            const inCooldown = lastInvested.ticker && lastInvested.date && dateDiff(date, lastInvested.date) < cooldownPeriod
            if (inCooldown) continue
        }
        // find the ticker with the highest sharpe ratio for this date
        let bestTicker = 'SHY'
        let bestSharpe = -Infinity
        stdout.write(`Date: ${date.toISOString().split('T')[0]}\n`)
        tickers.forEach(t => {
            const q = data[t].quotes.find(q => isSameDay(new Date(q.date), date))
            stdout.write(`  Ticker: ${t}, Sharpe Ratio: ${q ? q.sharpeRatio : 'N/A'}\n`)
            if (q && q.sharpeRatio !== undefined && q.sharpeRatio > bestSharpe) {
                bestSharpe = q.sharpeRatio
                bestTicker = t
            }
        })
        // no change
        if (bestTicker === lastInvested.ticker) continue
        // no positive sharpe ratio found, going to cash
        if (!bestTicker) {
            lastInvested.ticker = 'SHY' // cash equivalent
            lastInvested.date = date
            output.write(new Date(quotes[i].date).toISOString().split('T')[0] + ',')
            tickersAndCash.forEach(t => {
                if (t === 'SHY') {
                    output.write('100%,')
                } else {
                    output.write(',')
                }
            })
            output.write('\n')
            continue
        }
        // change in investment
        lastInvested.ticker = bestTicker
        lastInvested.date = date
        output.write(new Date(quotes[i].date).toISOString().split('T')[0] + ',')
        tickersAndCash.forEach(t => {
            if (t === bestTicker) {
                output.write('100%,')
            } else {
                output.write(',')
            }
        })
        output.write('\n')

    }
})
