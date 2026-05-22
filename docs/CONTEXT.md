# Technical Context — Currency Converter API

## Stack

| Layer | Tech |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (email/password + Google OAuth) |
| External APIs | Frankfurter, Twelve Data |
| Hosting | Render |
| Dev tooling | nodemon, dotenv |

## Architecture

The API follows a thin **route → service** pattern:

- **Routes** handle HTTP: parse params, call services/middleware, format responses, forward errors.
- **Middleware** handles cross-cutting concerns (auth token verification).
- **Services** own all external I/O (HTTP calls to third-party APIs, Supabase queries). They throw on failure; the global error handler in `index.js` catches and responds.

No ORM. Supabase JS client is used directly with the service role key, configured for server-side use (`autoRefreshToken: false`, `persistSession: false`).

---

## File Structure

```
src/
  index.js                  Express entry point
  middleware/
    auth.js                 JWT verification middleware
  routes/
    currencies.js           Currency list endpoint
    rates.js                Exchange rate endpoint with fallback logic
    stocks.js               Stock quote endpoints
    auth.js                 Authentication endpoints
    history.js              Conversion history endpoints (auth required)
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
Bootstraps Express. Sets `trust proxy: 1` (required for Render to resolve HTTPS via `X-Forwarded-Proto`). Registers CORS (allows `localhost:5173`, `localhost:8082`, the production Vercel domain, and `*.vercel.app` for preview deployments), JSON body parser, request logger, and all route prefixes.

**`src/middleware/auth.js`**
Exports two functions:
- `requireAuth` — extracts the Bearer token from `Authorization` header, calls `supabase.auth.getUser(token)` to verify it, attaches `req.user`, returns 401 if missing or invalid.
- `optionalAuth` — same but never blocks; sets `req.user = null` if no token.

**`src/routes/currencies.js`**
Single route. Delegates to `getCurrencies()` from the Supabase service.

**`src/routes/rates.js`**
Reads `?base` (default `USD`). Tries Frankfurter first; on any error falls back to `getFallbackRates(base)` from Supabase. Adds `source: "supabase_fallback"` to distinguish the fallback response on the client.

**`src/routes/stocks.js`**
Two routes:
- `GET /api/stocks/global` — fixed symbol list (AAPL, MSFT, GOOGL, AMZN, TSLA, META, NVDA, JPM), result cached 1 h.
- `GET /api/stocks/:code` — currency-code → symbol mapping. Returns `{ error }` if the code has no mapping.

**`src/routes/auth.js`**
Authentication endpoints. `logout` is stateless (responds 200, client discards token). Google OAuth generates the callback URL dynamically from `req.protocol` + `req.get('host')` so it works across environments. `OAUTH_REDIRECT_URL` has a hardcoded fallback to the production Vercel URL in case the env var is missing. `redirectUrl` is resolved once at module load and logged at startup.

**`src/routes/history.js`**
All routes protected by `router.use(requireAuth)`. DELETE filters by both `id` and `user_id` to prevent cross-user deletion.

**`src/services/frankfurter.js`**
Single exported function `getRates(base)`. Calls `https://api.frankfurter.app/latest?base=<base>`. Throws if status is not OK.

**`src/services/supabase.js`**
Creates a Supabase client with the service role key and server-side options (`autoRefreshToken: false`, `persistSession: false`). Exports the client plus two query helpers:
- `getCurrencies()` — `SELECT * FROM currencies`
- `getFallbackRates(base)` — `SELECT * FROM exchange_rates WHERE base = '<BASE>'`

**`src/services/twelvedata.js`**
Exports `getGlobalStocks()` and `getLocalStocks(code)`. Internal `fetchQuotes(symbols)` calls the Twelve Data `/quote` endpoint. Global stocks are wrapped in a module-level `globalCache = { data, expiresAt }` object; TTL is 3 600 000 ms (1 h).

---

## Endpoints

### `GET /health`
Health probe. Used by Render.

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
  "rates": [{ "base": "USD", "target": "EUR", "rate": 0.92 }]
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
Top stocks for a currency's region.

**Supported codes:** USD, EUR, GBP, JPY, CAD, AUD, CHF, CNY, INR, MXN, BRL, ARS, CLP, COP, PEN

**Error (unmapped code)**
```json
{ "error": "No local stocks mapped for currency: XYZ" }
```

---

### `POST /api/auth/register`
**Body:** `{ email, password }`
**Response 201:** Supabase user + session object

### `POST /api/auth/login`
**Body:** `{ email, password }`
**Response 200:** Supabase session object (includes `access_token`, `refresh_token`)

### `POST /api/auth/logout`
**Headers:** `Authorization: Bearer <token>`
Stateless — responds 200, client is responsible for discarding the token.
**Response:** `{ "message": "Sesión cerrada" }`

### `GET /api/auth/me`
**Headers:** `Authorization: Bearer <token>`
**Response:** `{ "user": { ...supabase user object } }`

### `GET /api/auth/google`
Redirects to Supabase Google OAuth URL. Sets callback to `<API_URL>/api/auth/callback`.

### `GET /api/auth/callback?code=xxx`
Exchanges the OAuth code for a session via `supabase.auth.exchangeCodeForSession(code)`.
Redirects to `OAUTH_REDIRECT_URL?token=<access_token>&refresh_token=<refresh_token>`.
On error redirects to `OAUTH_REDIRECT_URL?error=auth_failed`.

> **Supabase config required:** add `<API_URL>/api/auth/callback` to allowed Redirect URLs in Supabase → Authentication → URL Configuration.

---

### `GET /api/history`
**Headers:** `Authorization: Bearer <token>` (required)
Returns conversion history for the authenticated user, ordered by `created_at` descending.

**Response**
```json
[
  {
    "id": "uuid",
    "user_id": "uuid",
    "from_code": "USD",
    "to_code": "EUR",
    "amount": 100,
    "result": 92.5,
    "rate": 0.925,
    "created_at": "2024-05-17T12:00:00.000Z"
  }
]
```

### `POST /api/history`
**Headers:** `Authorization: Bearer <token>` (required)
**Body:** `{ from_code, to_code, amount, result, rate }`
**Response 201:** Created record

### `DELETE /api/history/:id`
**Headers:** `Authorization: Bearer <token>` (required)
Deletes the record only if it belongs to the authenticated user.
**Response:** 204 No Content

---

## Supabase Tables

### `currencies`
Stores available currency codes, names, and symbols. Read-only from the API.

### `exchange_rates`
Fallback exchange rate data. Read-only from the API.

### `conversion_history`
| Column | Type | Notes |
|---|---|---|
| `id` | uuid | Primary key, auto-generated |
| `user_id` | uuid | References `auth.users(id)` |
| `from_code` | text | Source currency code |
| `to_code` | text | Target currency code |
| `amount` | numeric | Amount converted |
| `result` | numeric | Converted amount |
| `rate` | numeric | Exchange rate used |
| `created_at` | timestamptz | Auto-set on insert |

**RLS is disabled** on `conversion_history`. Access control is enforced at the query level by always filtering `user_id = req.user.id`.

---

## Technical Decisions

**Express 5** — native async error propagation; no need to wrap every handler in try/catch just to call `next(err)`.

**`trust proxy: 1`** — Render terminates TLS at the load balancer and forwards requests over HTTP internally. Without this, `req.protocol` returns `"http"` and the OAuth callback URL is built with the wrong scheme.

**Dual-source exchange rates** — Frankfurter is free with no practical rate limit but is an external dependency. Supabase is a warm fallback so `/api/rates` never goes completely dark.

**In-memory cache for global stocks** — Twelve Data has a limited free tier. Module-level cache is the simplest approach for a single-instance Render deployment; no Redis needed at current scale.

**Stateless logout** — Supabase JS v2 does not expose `auth.admin.signOut`. Invalidating sessions server-side requires the Admin REST API directly. For this project, a 1-hour JWT TTL is acceptable, so logout is handled client-side.

**Service role key for Supabase** — the API is server-side only, never exposed to browsers. `autoRefreshToken: false` and `persistSession: false` are the recommended options for server-side clients and prevent the SDK from managing user sessions that don't apply in this context.

**RLS disabled on `conversion_history`** — simplifies queries since the service role bypasses RLS anyway. User isolation is enforced by filtering `user_id` in every query.

**Google OAuth callback URL built dynamically** — `req.protocol + req.get('host')` adapts to any environment (local, Render) without requiring an extra env var for the API's own URL.

---

## TODO

- [ ] Add CI/CD with GitHub Actions (lint + test on push to `main`)
- [ ] Add `.env.example` with placeholder values
- [ ] Add rate limiting (`express-rate-limit`) to protect the Twelve Data quota
- [ ] Persist global stocks cache to Supabase or Redis to survive Render restarts
- [ ] Add integration tests for the fallback path in `/api/rates`
- [ ] Add `GET /api/history` pagination
