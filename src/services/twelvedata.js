const LOCAL_STOCKS = {
  USD: ['AAPL', 'MSFT'],
  EUR: ['ASML', 'SAP'],
  GBP: ['BP', 'SHEL'],
  JPY: ['7203.T', '6758.T'],
  CAD: ['RY.TO', 'TD.TO'],
  AUD: ['CBA.AX', 'BHP.AX'],
  CHF: ['NESN.SW', 'ROG.SW'],
  CNY: ['601988.SS', '601398.SS'],
  INR: ['RELIANCE.NS', 'TCS.NS'],
  MXN: ['AMXL.MX', 'WALMEX.MX'],
  BRL: ['PETR4.SA', 'VALE3.SA'],
  ARS: ['GGAL', 'YPF'],
  CLP: ['FALABELLA.SN', 'SQM-B.SN'],
  COP: ['ECOPETROL.CL', 'NUTRESA.CL'],
  PEN: ['ALICORC1.LM', 'CREDITC1.LM'],
};

const GLOBAL_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'NVDA', 'JPM'];

let globalCache = { data: null, expiresAt: 0 };

async function fetchQuotes(symbols) {
  const key = process.env.TWELVE_DATA_KEY;
  const res = await fetch(
    `https://api.twelvedata.com/quote?symbol=${symbols.join(',')}&apikey=${key}`
  );
  if (!res.ok) throw new Error(`Twelve Data error: ${res.status}`);
  return res.json();
}

async function getLocalStocks(code) {
  const symbols = LOCAL_STOCKS[code.toUpperCase()];
  if (!symbols) return { error: `No local stocks mapped for currency: ${code}` };
  return fetchQuotes(symbols);
}

async function getGlobalStocks() {
  const now = Date.now();
  if (globalCache.data && now < globalCache.expiresAt) {
    return globalCache.data;
  }
  const data = await fetchQuotes(GLOBAL_SYMBOLS);
  globalCache = { data, expiresAt: now + 60 * 60 * 1000 };
  return data;
}

module.exports = { getLocalStocks, getGlobalStocks };
