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
