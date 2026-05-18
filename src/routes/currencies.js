const express = require('express');
const router = express.Router();
const { getCurrencies } = require('../services/supabase');

router.get('/', async (req, res, next) => {
  try {
    const data = await getCurrencies();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
