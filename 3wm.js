    import YahooFinance from "yahoo-finance2";
    import fs from "fs";
    import { SMA } from "technicalindicators";

    const yahooFinance = new YahooFinance();
    const allData = {};

    const tickers = ['SPY', 'LTL', 'GLD']
    const options = {
        period1: '1990-12-31',
        period2: '2024-01-01',
        interval: '1d'
    };
    const signal = (data, index) => {
        const sma66 = SMA.calculate({ period: 66, values: data.slice(index - 66, index) }).pop();
        const sma220 = SMA.calculate({ period: 220, values: data.slice(index - 220, index) }).pop();
        return sma66 > sma220;
    }
    Promise.allSettled(
        tickers.map(async (ticker) => {
            console.log(`Fetching data for ${ticker}...`);

            const historical = await yahooFinance.historical(ticker, options);
            const tickerFile = fs.createWriteStream(`data_${ticker}.csv`);
            historical.forEach((day, index) => {
                if (index === 0) return; // Skip first day
                const date = new Date(day.date).toISOString().split('T')[0];
                const change = (day.open / historical[index - 1].open - 1) * 100;
                tickerFile.write(`${date},${change}\n`);
            });
            tickerFile.end();
            return new Promise((resolve) => {
                historical.forEach((day, index) => {
                    if (!historical[index - 221]) return; // Skip first day
                    const date = new Date(day.date).toISOString().split('T')[0];
                    const profit = (day.close / historical[index - 1].close - 1) * 100;
                    if (!allData[date]) allData[date] = {};
                    allData[date][ticker] = { signal: signal(historical.map(d => d.close), index), profit };
                });
                resolve();
            });
        })
    ).then(() => {
        const writeStream = fs.createWriteStream(`historical.csv`);
        let prevSignal = false;
        Object.keys(allData).forEach((date, index) => {
            const profits = [];
            Object.keys(allData[date]).forEach(ticker => {
                if (prevSignal !== allData[date][ticker].signal) {
                    console.log(`${date} Signal changed for ${ticker} (${prevSignal}->${allData[date][ticker].signal})`);
                    prevSignal = allData[date][ticker].signal;
                }
                if (allData[date][ticker].signal) {
                    profits.push(allData[date][ticker].profit);
                }
            });
            const avgProfit = profits.length ? (profits.reduce((a, b) => a + b, 0) / profits.length) : 0;
            writeStream.write(`${date},${avgProfit}\n`);
        });
        writeStream.end();
    });
    console.log('Done.');

