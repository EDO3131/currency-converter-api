# Currency Converter API — Claude Context

## Stack
Node.js + Express 5, deployed on Railway.

## Dev
```bash
npm run dev   # nodemon, port 3001
npm start     # production
```

## URLs
- Local: `http://localhost:3001`
- Production: `https://currency-converter-api-production-74f8.up.railway.app`

## Env vars required
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role JWT |
| `TWELVE_DATA_KEY` | TwelveData stock API key |
| `PORT` | Server port (defaults to 3001) |

## External APIs
- **Frankfurter** (`frankfurter.app`) — exchange rates, no auth required
- **Supabase** — DB fallback for rates + currency list
- **Twelve Data** — stock quotes, requires `TWELVE_DATA_KEY`

## Architecture
```
src/
  index.js          # Express setup, CORS, logging, global error handler
  routes/
    currencies.js   # GET /api/currencies
    rates.js        # GET /api/rates  (Frankfurter → Supabase fallback)
    stocks.js       # GET /api/stocks/global  |  GET /api/stocks/:code
  services/
    frankfurter.js  # Frankfurter API client
    supabase.js     # Supabase client + getCurrencies / getFallbackRates
    twelvedata.js   # TwelveData client + in-memory 1h cache for global stocks
```

## Key patterns
- Services throw; routes catch and forward to global error handler.
- Global stocks are cached in-memory for 1 hour (no Redis).
- `/api/rates` has a primary/fallback dual-source: Frankfurter first, Supabase if it fails.
- CORS allows `localhost:5173` (Vite frontend) and `localhost:8082`.
