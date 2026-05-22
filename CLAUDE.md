# Currency Converter API — Claude Context

## Stack
Node.js + Express 5, deployed on Render.

## Dev
```bash
npm run dev   # nodemon, port 3001
npm start     # production
```

## URLs
- Local: `http://localhost:3001`
- Production: `https://currency-converter-api-gk8z.onrender.com`

## Env vars required
| Variable | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role JWT |
| `TWELVE_DATA_KEY` | TwelveData stock API key |
| `OAUTH_REDIRECT_URL` | Frontend URL for OAuth callback redirect (Render) |
| `PORT` | Server port (defaults to 3001) |

## External APIs
- **Frankfurter** (`frankfurter.app`) — exchange rates, no auth required
- **Supabase** — DB fallback for rates, currency list, auth, conversion history
- **Twelve Data** — stock quotes, requires `TWELVE_DATA_KEY`

## Architecture
```
src/
  index.js            # Express setup, trust proxy, CORS, logging, error handler
  middleware/
    auth.js           # requireAuth / optionalAuth — verifica JWT de Supabase
  routes/
    currencies.js     # GET /api/currencies
    rates.js          # GET /api/rates  (Frankfurter → Supabase fallback)
    stocks.js         # GET /api/stocks/global  |  GET /api/stocks/:code
    auth.js           # POST register/login/logout  GET me/google/callback
    history.js        # GET/POST/DELETE /api/history  (requiere auth)
  services/
    frankfurter.js    # Frankfurter API client
    supabase.js       # Supabase client (service role, sin RLS, sin persistSession)
    twelvedata.js     # TwelveData client + in-memory 1h cache para global stocks
```

## Key patterns
- Services throw; routes catch y forwardean al global error handler.
- Global stocks cacheados in-memory 1 hora (sin Redis).
- `/api/rates` tiene dual-source: Frankfurter primero, Supabase si falla.
- Auth: JWT stateless. Logout solo responde 200 — el cliente descarta el token.
- Google OAuth: `GET /api/auth/google` → redirige a Supabase → callback en `/api/auth/callback` → redirige al frontend con `?token=&refresh_token=`.
- `trust proxy: 1` activado para que `req.protocol` lea `X-Forwarded-Proto` de Render.
- CORS permite `localhost:5173`, `localhost:8082`, el dominio de Vercel y `*.vercel.app`.
- Supabase client configurado con `autoRefreshToken: false, persistSession: false` (server-side).
- `conversion_history` tiene RLS deshabilitado — el acceso se controla por `user_id` en las queries.
