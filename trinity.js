// load yahoo finance, technical indicators, 
import YahooFinance from "yahoo-finance2";
import { SMA } from "technicalindicators";
import fs from "fs";
// create config section (period, etc.) and output file
const period = {
    period1: '2002-08-01',
    period2: '2025-10-31',
    interval: '1d'
}
const outputFile = fs.createWriteStream('Trinity.csv');
const yahooFinance = new YahooFinance();
// load GLD, TLT, and SPY data
const GLDData = await yahooFinance.chart('GLD', period);
const TLTData = await yahooFinance.chart('TLT', period);
const SPYData = await yahooFinance.chart('SPY', period);
// iterate through data (shortest data will be used) 
const maxLookback = Math.min(GLDData.quotes.length, TLTData.quotes.length, SPYData.quotes.length);
// and apply Trinity strategy:
// - invest equally in GLD, TLT, and SPY
// - if price is above 200-day SMA, stay invested
// - if price is below 200-day SMA, move to cash (0% return)
// start iteration from the latest date minus the maxLookback,
// each day the profit/loss is the change in price of ivested assets
// or 0 if moved to cash
let totalReturn = 1;
// cooldown is the number of days to wait after a trade before making another trade
let cooldown = 20;
let lastTradeDate = null;
// start with the oldest data point within the lookback window
for (let i = 0; i < maxLookback; i++) {
    const GLDQuote = GLDData.quotes[i + (GLDData.quotes.length - maxLookback)];
    const TLTQuote = TLTData.quotes[i + (TLTData.quotes.length - maxLookback)];
    const SPYQuote = SPYData.quotes[i + (SPYData.quotes.length - maxLookback)];
    const GLDSMA200 = SMA.calculate({ period: 200, values: GLDData.quotes.slice(i + (GLDData.quotes.length - maxLookback) - 200, i + (GLDData.quotes.length - maxLookback)).map(q => q.close) }).pop();
    const TLTSMA200 = SMA.calculate({ period: 200, values: TLTData.quotes.slice(i + (TLTData.quotes.length - maxLookback) - 200, i + (TLTData.quotes.length - maxLookback)).map(q => q.close) }).pop();
    const SPYSMA200 = SMA.calculate({ period: 200, values: SPYData.quotes.slice(i + (SPYData.quotes.length - maxLookback) - 200, i + (SPYData.quotes.length - maxLookback)).map(q => q.close) }).pop();
    if (!GLDSMA200 || !TLTSMA200 || !SPYSMA200 || lastTradeDate && (GLDQuote.date - lastTradeDate) / (1000 * 60 * 60 * 24) < cooldown) {
        continue; // skip until we have enough data for SMA200
    }
    // calculate change to the previous close in percentage, and add as .change property
    GLDQuote.change = (GLDQuote.close - GLDData.quotes[i + (GLDData.quotes.length - maxLookback) - 1].close) / GLDData.quotes[i + (GLDData.quotes.length - maxLookback) - 1].close * 100;
    TLTQuote.change = (TLTQuote.close - TLTData.quotes[i + (TLTData.quotes.length - maxLookback) - 1].close) / TLTData.quotes[i + (TLTData.quotes.length - maxLookback) - 1].close * 100;
    SPYQuote.change = (SPYQuote.close - SPYData.quotes[i + (SPYData.quotes.length - maxLookback) - 1].close) / SPYData.quotes[i + (SPYData.quotes.length - maxLookback) - 1].close * 100;

    let dailyReturn = 0;
    let investedAssets = [];
    if (GLDQuote.close > GLDSMA200) {
        dailyReturn += GLDQuote.change;
        investedAssets.push('GLDQuote');
    }
    if (TLTQuote.close > TLTSMA200) {
        dailyReturn += TLTQuote.change;
        investedAssets.push('TLTQuote');
    }
    if (SPYQuote.close > SPYSMA200) {
        dailyReturn += SPYQuote.change;
        investedAssets.push('SPYQuote');
    }
    if (investedAssets.length > 0) {
        dailyReturn = dailyReturn / investedAssets.length;
    } else {
        dailyReturn = 0; // moved to cash
    }
    totalReturn *= (1 + dailyReturn / 100);
    // write date and daily return to output file
    outputFile.write(`${GLDQuote.date.toISOString().split('T')[0]},${dailyReturn.toFixed(4)},${investedAssets}\n`);
}
outputFile.end();
console.log(`Final Total Return: ${(totalReturn * 100).toFixed(2)}%`);
// output daily returns and total return to CSV file