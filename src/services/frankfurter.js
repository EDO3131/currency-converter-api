async function getRates(base = 'USD') {
  const res = await fetch(`https://api.frankfurter.app/latest?from=${encodeURIComponent(base)}`);
  if (!res.ok) throw new Error(`Frankfurter error: ${res.status}`);
  return res.json();
}

module.exports = { getRates };
