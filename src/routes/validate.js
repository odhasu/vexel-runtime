const { validateLicense } = require('../services/licenseService');
const rateLimit = require('../middleware/rateLimit');

async function handleValidate(req, res) {
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const allowed = await rateLimit(ip, 'validate', 60);
  if (!allowed) {
    return res.status(429).json({ status: 'error', reason: 'rate_limited' });
  }

  const { licenseKey, domain, permanentDomain } = req.body || {};

  if (!licenseKey) {
    return res.status(400).json({ status: 'invalid', reason: 'missing_key' });
  }

  try {
    const checkDomain = permanentDomain || domain || '';
    const result = await validateLicense(licenseKey, checkDomain);

    if (result.valid) {
      return res.json({ status: 'ok', plan: result.plan });
    }

    return res.status(403).json({ status: 'invalid', reason: result.reason });
  } catch (e) {
    console.error('[Validate] error:', e.message);
    // Fail open — if server has issues, let the theme render
    return res.json({ status: 'ok', plan: 'standard' });
  }
}

module.exports = handleValidate;
