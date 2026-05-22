const { Router } = require('express');
const { supabase } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('conversion_history')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    console.log('[history/post] body:', req.body);
    console.log('[history/post] user:', req.user?.id);
    const { from_code, to_code, amount, result, rate } = req.body;
    const { data, error } = await supabase
      .from('conversion_history')
      .insert({ user_id: req.user.id, from_code, to_code, amount, result, rate })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (err) {
    console.error('[history/post] error:', err);
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { error } = await supabase
      .from('conversion_history')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
