import YahooFinance from "yahoo-finance2";
import Fred from "./fred.js";
import { SMA } from "technicalindicators";
import fs from "fs";

const period = {
    period1: '2002-08-01',
    period2: '2025-10-31',
    interval: '1d'
}
const file = fs.createWriteStream('output.csv');
const yahooFinance = new YahooFinance();
const fred = new Fred('');
const RRSFS = await fred.getData('RRSFS')
const INDPRO = await fred.getData('INDPRO')
const FINAL = []
class Asset {
    #assets;
    #symbol;
    #data = {};
    constructor(assets) {
        this.#assets = assets;
        this.#symbol = assets[0];
        this.#data = {};
    }
    switchToOffensive() {
        this.#symbol = this.#assets[1];
    }
    switchToDefensive() {
        this.#symbol = this.#assets[0];
    }
    switch() {
        this.#symbol = this.#symbol === this.#assets[0] ? this.#assets[1] : this.#assets[0];
    }
    async load() {
        const results = await Promise
            .all(this.#assets.map(asset => {
                return yahooFinance
                    .chart(asset, period);
            }));
        results.forEach(result => {
            const historical = result.quotes;
            this.#data[result.meta.symbol] =
                historical.map((day, index) => {
                    const percentage = index === 0 ? 0 : (day.close / historical[index - 1].close - 1) * 100;
                    day.change = percentage;
                    return day;
                });
        });
    }
    get current() {
        return this.#data[this.#symbol];
    }
    get data() {
        return this.#data;
    }

    get symbol() {
        return this.#symbol;
    }
}

const dateDiff = (date1, date2, abs = true) => {
    const diffTime = abs ? Math.abs(date1 - date2) : (date1 - date2);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

const asset = new Asset(['SHY', 'QQQ']);
await asset.load();

const signal = await yahooFinance
    .chart('SPY', period)
    .then(data => {
        return data.quotes.reduce((acc, day, index) => {
            if (index < 220) {
                return acc;
            };
            const sma220 = SMA.calculate({ period: 220, values: acc.slice(index - 220, index).map(d => d.close) }).pop();
            acc[index].sma220 = sma220;
            return acc;
        }, data.quotes);
    });
const cooldownPeriod = 30; // calendar days
const lastActionDate = new Date(signal[0].date);
let lastAction;
signal.forEach((day) => {
    // Good Morning!
    // console.debug('Step 1: The Macroeconomic Filter (The Growth Check)');
    const rrsfs = RRSFS.findLast(d => dateDiff(new Date(day.date), new Date(d.date), false) < 0);
    const indpro = INDPRO.findLast(d => dateDiff(new Date(day.date), new Date(d.date), false) < 0);
    const prevAction = lastAction;

    if (dateDiff(new Date(lastActionDate), new Date(day.date)) > cooldownPeriod) {
        if (day.sma220 === undefined) {
            asset.switchToDefensive();
            lastAction = 'cash';
        }
        if (rrsfs?.change > 0 && indpro?.change > 0) {
            // console.debug('Growth Positive -> Ignore Price: Go to Equities (Step 2 is skipped)');
            asset.switchToOffensive();
            lastAction = 'invested';
        } else if (day.sma220 !== undefined) {
            // console.debug('Growth Negative -> Activate Price Filter: Go to Trend Check (Step 2)');
            // console.debug('Step 2: The Trend Filter (The Confirmation Check)')
            if (day.close > day.sma220) {
                // console.log(`${lastAction !== 'invested' ? 'Move to' : 'Stay'} invested on ${new Date(day.date).toISOString().split('T')[0]} (Close: ${day.close}, SMA220: ${day.sma220})`);
                lastAction = 'invested';
            } else {
                // console.log(`${lastAction !== 'cash' ? 'Move to' : 'Stay in'} cash on ${new Date(day.date).toISOString().split('T')[0]} (Close: ${day.close}, SMA220: ${day.sma220})`);
                lastAction = 'cash';
            }
        }
    }
    if (prevAction !== lastAction) {
        console.log(`[${new Date(day.date).toISOString().split('T')[0]}] Switching asset... ${prevAction} -> ${lastAction}`);
        asset.switch();
        lastActionDate.setTime(new Date(day.date).getTime());
    }
    const eod = asset.current.find(d => isSameDay(new Date(d.date), new Date(day.date)));
    // Good Evening!
    FINAL.push(`${new Date(day.date).toISOString().split('T')[0]},${eod.change}`);
});

file.write(FINAL.join('\n'));
file.end();
