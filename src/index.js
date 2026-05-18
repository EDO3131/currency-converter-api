require('dotenv').config();
const express = require('express');
const cors = require('cors');

const ratesRouter = require('./routes/rates');
const currenciesRouter = require('./routes/currencies');
const stocksRouter = require('./routes/stocks');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:8082'],
}));

app.use(express.json());

app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()}  ${req.method}  ${req.url}`);
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/rates', ratesRouter);
app.use('/api/currencies', currenciesRouter);
app.use('/api/stocks', stocksRouter);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
