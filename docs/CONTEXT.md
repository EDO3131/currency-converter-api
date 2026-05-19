# Technical Context — Currency Converter API

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | Supabase (PostgreSQL) |
| External APIs | Frankfurter, Twelve Data |
| Hosting | Railway |
| Dev tooling | nodemon, dotenv |

## Architecture

The API follows a thin **route → service** pattern:

- **Routes** handle HTTP: parse query params, call services, format responses, forward errors.
- **Services** own all external I/O (HTTP calls to third-party APIs, Supabase queries). They throw on failure; the global error handler in `index.js` catches and responds.

No ORM. Supabase JS client is used directly with the service role key for full table access.

---

## File Structure

```
src/
  index.js                  Express entry point
  routes/
    currencies.js           Currency list endpoint
    rates.js                Exchange rate endpoint with fallback logic
    stocks.js               Stock quote endpoints
  services/
    frankfurter.js          Frankfurter API wrapper
    supabase.js             Supabase client + query helpers
    twelvedata.js           Twelve Data wrapper + in-memory cache
docs/
  CONTEXT.md                This file
CLAUDE.md                   Short context for Claude Code
```

### File purposes

**`src/index.js`**
Bootstraps Express. Registers CORS (allows `localhost:5173` and `localhost:8082`), JSON body parser, request logger, and all route prefixes. Exports nothing — runs on import.

**`src/routes/currencies.js`**
Single route. Delegates to `getCurrencies()` from the Supabase service and returns the array.

**`src/routes/rates.js`**
Reads `?base` (default `USD`). Tries Frankfurter first; on any error falls back to `getFallbackRates(base)` from Supabase. Adds `source: "supabase_fallback"` to the fallback response so the client can distinguish them.

**`src/routes/stocks.js`**
Two routes:
- `GET /api/stocks/global` — fixed symbol list (AAPL, MSFT, GOOGL, AMZN, TSLA, META, NVDA, JPM), result cached 1 h.
- `GET /api/stocks/:code` — currency-code → symbol mapping. Returns `{ error }` if the code has no mapping.

**`src/services/frankfurter.js`**
Single exported function `getRates(base)`. Calls `https://api.frankfurter.app/latest?base=<base>`. Throws if status is not OK.

**`src/services/supabase.js`**
Creates a Supabase client with the service role key. Exports the client plus two query helpers:
- `getCurrencies()` — `SELECT * FROM currencies`
- `getFallbackRates(base)` — `SELECT * FROM exchange_rates WHERE base = '<BASE>'`

**`src/services/twelvedata.js`**
Exports `getGlobalStocks()` and `getLocalStocks(code)`. Internal `fetchQuotes(symbols)` calls the Twelve Data `/quote` endpoint. Global stocks are wrapped in a module-level `globalCache = { data, expiresAt }` object; TTL is 3 600 000 ms (1 h). Local stocks use a hard-coded `LOCAL_STOCKS` map of currency code → symbol array.

---

## Endpoints

### `GET /health`
Health probe. Used by Railway.

**Response**
```json
{ "status": "ok", "timestamp": "2024-05-17T12:00:00.000Z" }
```

---

### `GET /api/currencies`
Returns all rows from the `currencies` Supabase table.

**Response**
```json
[
  { "code": "USD", "name": "US Dollar", "symbol": "$" },
  { "code": "EUR", "name": "Euro", "symbol": "€" }
]
```

---

### `GET /api/rates?base=USD`
Exchange rates relative to the base currency.

**Query params**
| Param | Default | Description |
|---|---|---|
| `base` | `USD` | ISO 4217 currency code |

**Primary response (Frankfurter)**
```json
{
  "amount": 1,
  "base": "USD",
  "date": "2024-05-17",
  "rates": { "EUR": 0.92, "GBP": 0.79 }
}
```

**Fallback response (Supabase)**
```json
{
  "source": "supabase_fallback",
  "rates": [
    { "base": "USD", "target": "EUR", "rate": 0.92 }
  ]
}
```

---

### `GET /api/stocks/global`
Top global stocks. Cached in-memory for 1 hour.

**Fixed symbols:** AAPL, MSFT, GOOGL, AMZN, TSLA, META, NVDA, JPM

**Response**
```json
{
  "status": "ok",
  "data": [
    {
      "symbol": "AAPL",
      "name": "Apple Inc.",
      "exchange": "NASDAQ",
      "type": "Common Stock",
      "currency": "USD",
      "price": 150.25,
      "previous_close": 149.80,
      "change": 0.45,
      "percent_change": 0.30
    }
  ]
}
```

---

### `GET /api/stocks/:code`
Top stocks for a currency's region. `:code` is an ISO 4217 currency code (e.g. `EUR`, `JPY`).

**Supported codes and symbols**
| Code | Symbols |
|---|---|
| USD | AAPL, MSFT |
| EUR | ASML, SAP |
| GBP | BP, SHEL |
| JPY | 7203.T, 6758.T |
| CAD | RY.TO, TD.TO |
| AUD | CBA.AX, BHP.AX |
| CHF | NESN.SW, ROG.SW |
| CNY | 601988.SS, 601398.SS |
| INR | RELIANCE.NS, TCS.NS |
| MXN | AMXL.MX, WALMEX.MX |
| BRL | PETR4.SA, VALE3.SA |
| ARS | GGAL, YPF |
| CLP | FALABELLA.SN, SQM-B.SN |
| COP | ECOPETROL.CL, NUTRESA.CL |
| PEN | ALICORC1.LM, CREDITC1.LM |

**Error (unmapped code)**
```json
{ "error": "No local stocks mapped for currency: XYZ" }
```

---

## Technical Decisions

**Express 5** — chosen for native async error propagation; `next(err)` is not needed in async route handlers.

**Dual-source exchange rates** — Frankfurter is free and has no rate limit in practice, but it's an external dependency. Supabase acts as a warm fallback so the `/api/rates` endpoint never goes completely dark.

**In-memory cache for global stocks** — Twelve Data has a limited free tier. Caching at the module level is the simplest approach for a single-instance deployment on Railway; no Redis needed at current scale.

**Service role key for Supabase** — the API is server-side only and never exposed to browsers, so using the service role key is safe. No RLS policies are bypassed unexpectedly.

**No `.env.example`** — should be added. See TODO below.

---

## TODO

- [ ] Add CI/CD with GitHub Actions (lint + test on push to `main`, deploy to Railway on merge)
- [ ] Add `.env.example` with placeholder values
- [ ] Add rate limiting (e.g. `express-rate-limit`) to protect the Twelve Data quota
- [ ] Persist global stocks cache to Supabase or Redis to survive Railway restarts
- [ ] Add integration tests for the fallback path in `/api/rates`
