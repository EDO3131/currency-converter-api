const { supabase } = require('../services/supabase');

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid Authorization header' });
    }
    const { data: { user }, error } = await supabase.auth.getUser(header.slice(7));
    if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

async function optionalAuth(req, _res, next) {
  try {
    req.user = null;
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next();
    const { data: { user } } = await supabase.auth.getUser(header.slice(7));
    req.user = user || null;
    next();
  } catch {
    next();
  }
}

module.exports = { requireAuth, optionalAuth };
