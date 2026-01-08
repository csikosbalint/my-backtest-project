import YahooFinance from 'yahoo-finance2'
import fs from 'fs';
import { enrichWithReturns, enrichWithSharpe } from './tools.js';
import { calculateReturns } from '@railpath/finance-toolkit';

const ticker = 'SPY'
const period = {
    period1: '2020-01-01',
    period2: '2025-12-31',
    interval: '1d'
}

// read from fs sharpe_agy.csv data and load 2nd column as returns array
const sharpeData = fs.readFileSync('sharpe_agy.csv', 'utf-8');
// const close = sharpeData.split('\n').slice(1).map(line => {
//     const parts = line.split(',');
//     return parseFloat(parts[1]);
// })
//     .filter(r => !isNaN(r))
//     .map(r => ({ adjclose: r }));
// calculate returns to close prices
const yahooFinance = new YahooFinance()
const close = await yahooFinance.chart(ticker, period)
enrichWithReturns({ quotes: close.quotes, lookback: 250 })
enrichWithSharpe({ quotes: close.quotes, lookback: 250 })
console.log(`Calculated Sharpe Ratio for ${ticker}: ${close.quotes[close.quotes.length - 1].sharpe}`);
