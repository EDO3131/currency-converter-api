const express = require('express');
const router = express.Router();
const { getRates } = require('../services/frankfurter');
const { getFallbackRates } = require('../services/supabase');

router.get('/', async (req, res, next) => {
  const base = req.query.base || 'USD';
  try {
    const data = await getRates(base);
    res.json(data);
  } catch (primaryErr) {
    try {
      const fallback = await getFallbackRates(base);
      res.json({ source: 'supabase_fallback', rates: fallback });
    } catch {
      next(primaryErr);
    }
  }
});

module.exports = router;
