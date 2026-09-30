// Only enable behind a private Cloud Run service invoked by the FMDS gateway.
// IAM authenticates the caller; the gateway replaces browser identity headers.
function hostedAuth({ enabled = process.env.FMDS_HOSTED === 'true' } = {}) {
  return (req, res, next) => {
    if (!enabled || (req.path === '/health' && req.method === 'GET')) return next();
    const email = req.get('x-fmds-user-email');
    if (!email || req.get('x-fmds-app-id') !== 'matt-planner') return res.status(401).json({ ok: false, error: 'FMDS gateway authentication required' });
    const canEdit = req.get('x-fmds-can-edit') === 'true';
    req.fmdsUser = { id: email, username: email, role: canEdit ? 'admin' : 'viewer' };
    if (req.path === '/api/login' || req.path === '/api/logout') return res.status(409).json({ ok: false, error: 'Use your FMDS session' });
    if (req.path === '/api/data/vf_users') {
      if (req.method !== 'GET') return res.status(403).json({ ok: false, error: 'FMDS owns user access' });
      return res.json({ exists: true, value: [req.fmdsUser] });
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !canEdit) return res.status(403).json({ ok: false, error: 'FMDS planner edit permission required' });
    next();
  };
}
module.exports = { hostedAuth };
