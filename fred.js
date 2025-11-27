import fs from "fs";
const BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';
export default class Fred {
    constructor(apiKey = 'aaaaa') {
        this.apiKey = apiKey;
    }
    async getData(seriesId) {
        try {
            const data = fs.readFileSync(`data_${seriesId}.json`, 'utf-8');
            const jsonData = JSON.parse(data);
            return jsonData;
        } catch (err) {
            try {
                const url = `${BASE_URL}?series_id=${seriesId}&api_key=${this.apiKey}&file_type=json`;
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Error: ${response.statusText}`);

                const data = await response.json();

                // observations contains the historical array [{ date: '...', value: '...' }, ...]
                const salesData = data.observations.map(obs => ({
                    date: obs.date,
                    value: parseFloat(obs.value) // Values are in Millions of 1982-84 CPI Adjusted Dollars
                }));

                const fetchedData = salesData.map((day, index) => {
                    const change = index === 0 ? 0 : (day.value / salesData[index - 1].value - 1) * 100;
                    return { ...day, change };
                })
                fs.writeFileSync(`data_${seriesId}.json`, JSON.stringify(fetchedData, null, 2));
                return fetchedData;
            } catch (error) {
                console.error('Failed to retrieve data:', error.message);
            }
        }
    }
}