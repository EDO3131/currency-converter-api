const express = require('express');
const router = express.Router();
const { getLocalStocks, getGlobalStocks } = require('../services/twelvedata');

// /global must be registered before /:code or Express matches "global" as a code
router.get('/global', async (req, res, next) => {
  try {
    const data = await getGlobalStocks();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/:code', async (req, res, next) => {
  try {
    const data = await getLocalStocks(req.params.code);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
