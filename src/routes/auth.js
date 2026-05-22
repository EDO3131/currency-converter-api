const { Router } = require('express');
const { supabase } = require('../services/supabase');
const { requireAuth } = require('../middleware/auth');

const router = Router();

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return res.status(400).json({ error: error.message });
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return res.status(401).json({ error: error.message });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/logout', requireAuth, async (req, res, next) => {
  try {
    const { error } = await supabase.auth.admin.signOut(req.user.id);
    if (error) return next(error);
    res.json({ message: 'Logged out' });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.get('/google', async (req, res, next) => {
  try {
    const callbackUrl = `${req.protocol}://${req.get('host')}/api/auth/callback`;
    console.log('[google oauth] callbackUrl:', callbackUrl);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    });
    if (error) return next(error);
    res.redirect(data.url);
  } catch (err) {
    next(err);
  }
});

router.get('/callback', async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) return res.redirect(`${process.env.OAUTH_REDIRECT_URL}?error=missing_code`);

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return res.redirect(`${process.env.OAUTH_REDIRECT_URL}?error=auth_failed`);

    const { access_token, refresh_token } = data.session;
    res.redirect(`${process.env.OAUTH_REDIRECT_URL}?token=${access_token}&refresh_token=${refresh_token}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
