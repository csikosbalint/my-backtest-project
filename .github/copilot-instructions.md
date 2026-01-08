# Copilot / Agent Guidance — my-backtest-project

This repository contains small Node.js backtest scripts that fetch market and macro data, compute indicators, and emit CSV outputs. Use these concise rules to be immediately productive.

- **Runtime**: Node.js (ES modules). This project sets `"type": "module"` in `package.json` and uses top-level `await`. Use Node 16+ when running files.
- **How to run**: run individual scripts directly, e.g. `FRED_API_KEY=yourkey node sharpe.js`, `node trinity.js`, or `node laa.js`. `laa.js` calls `dotenv.config()` so you may also rely on a `.env` file there.
- **Primary files**:

  - `sharpe.js`: computes rolling Sharpe ratios using `@railpath/finance-toolkit` and FRED short-term rate (`TB3MS`). Writes `sharpe_chart.csv` and `sharpe_output.csv`.
  - `trinity.js`: implements a 3-way Trinity strategy using `technicalindicators` SMAs; writes `Trinity.csv` and `3way_alloc.csv`.
  - `laa.js`: LAA strategy using an `Asset` class (private fields), FRED series `RRSFS`, `INDPRO`, and `technicalindicators` SMA220. Writes `LAA.csv`.
  - `fred.js`: local-first FRED helper — it tries to read `data_<SERIES>.json` from disk and falls back to fetching from the FRED API, then writes a cache file. Agents should prefer editing this file if changing data retrieval behavior.
  - `tools.js`: small date helpers used across scripts: `dateDiff`, `closestDate`, `isSameDay`.

- **Data conventions**:

  - Time series values and returns are commonly represented as percentages (e.g. `change`, `return` fields are percent values, not decimals).
  - Dates are ISO strings; scripts use `new Date(...).toISOString().split('T')[0]` for CSV output.
  - FRED cached files follow the naming `data_<SERIES>.json` (examples present in repo: `data_TB3MS.json`, `data_RRSFS.json`).

- **Important libraries & patterns**:

  - `yahoo-finance2` for price data (returned object has `meta` and `quotes` arrays).
  - `technicalindicators` for SMA calculations (note many scripts call `.pop()` on calculated arrays to get the latest value).
  - `@railpath/finance-toolkit` used only for `calculateSharpeRatio` in `sharpe.js`.
  - CSV output is created with `fs.createWriteStream()` and incremental `.write()` calls — preserve this streaming pattern when modifying outputs.

- **Environment & secrets**:

  - `fred.js` expects an API key passed to `new Fred(process.env.FRED_API_KEY)` (some scripts call `dotenv.config()` explicitly, others do not). Ensure `FRED_API_KEY` is present in the environment when running scripts that call `Fred`.

- **Concurrency & data flow**:

  - Scripts often use `Promise.all()` with `yahooFinance.chart()` calls to fetch multiple tickers in parallel and then align them by the shortest historical length. Keep alignment logic intact (start indices use `quotes.length - minLength`).
  - Rolling/window calculations are implemented by slicing arrays (e.g., `slice(i - window, i)`) rather than streaming windows; avoid changing the indexing approach without validating outputs.

- **Edge cases agents should preserve**:

  - Scripts treat missing SMA or insufficient lookback by writing default allocations or skipping until enough data is available.
  - `fred.js` parses fetched `value` fields to floats and writes caches; maintain that parsing and caching behavior.

- **When editing code**:

  - Keep CSV schema stable (header order and column names) unless the user asks to change outputs; many downstream processes may parse these CSVs.
  - Preserve the repository's small-script style (single-file scripts per strategy) and explicit synchronous file writes for reproducibility.

- **Formatting**:
  - Do not include trailing commas at the end of lines in generated outputs or CSV rows. Ensure lines end without a comma (e.g. `a,b,c` **not** `a,b,c,`).
  - When writing CSVs with incremental `.write()` calls, explicitly end a row with `\n` and avoid writing a final comma before the newline.

If anything in these notes is unclear or you want more examples (e.g., exact CSV header schemas or a run script), tell me which area to expand and I'll iterate.
