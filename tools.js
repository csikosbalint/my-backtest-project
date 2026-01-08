import { calculateReturns, calculateStandardDeviation } from "@railpath/finance-toolkit";

export const dateDiff = (date1, date2, abs = true) => {
    const diffTime = abs ? Math.abs(date1 - date2) : (date1 - date2);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// closest date
export const closestDate = (date, datesArray) => {
    return datesArray.reduce((a, b) => {
        return Math.abs(new Date(a) - date) < Math.abs(new Date(b) - date) ? a : b;
    });
}

export const isSameDay = (date1, date2) => {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

// calculate return in percentage for each day and add it to quotes
export const enrichWithReturns = ({ quotes, lookback = 1 }) => {
    if (quotes.length < lookback) {
        throw new Error('Not enough data to calculate returns with the specified lookback period');
    }
    for (let i = lookback; i < quotes.length; i++) {
        const prevClose = quotes[i - lookback].adjclose;
        const currClose = quotes[i].adjclose;
        quotes[i].return = ((currClose - prevClose) / prevClose) * 100; // return in percentage
    }
    return quotes;
}


// calcualte sharpe ratio method (use return from lookback days, to current day)
// riskfree is 0 by default, no annualization factor applied here
export const enrichWithSharpe = ({ quotes, riskFreeRate = 0, lookback = 1 }) => {
    if (quotes.length < lookback) {
        throw new Error('Not enough return data to calculate Sharpe Ratio with the specified lookback period');
    }
    enrichWithReturns({ quotes, lookback });
    for (let i = 2 * lookback; i < quotes.length; i++) {
        const returnWindow = quotes.slice(i - lookback, i).map(q => q.return);
        const deviation = calculateStandardDeviation(returnWindow);
        quotes[i].deviation = deviation;
        const sharpeRatio = (quotes[i].return - riskFreeRate) / deviation;
        quotes[i].sharpeRatio = sharpeRatio;
    }
    return quotes;
}