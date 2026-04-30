const normalizeDomain = require('../utils/domainNorm');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function validateLicense(licenseKey, domain) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('Supabase not configured');
  }

  const url = `${SUPABASE_URL}/rest/v1/subscriptions?license_key=eq.${encodeURIComponent(licenseKey)}&select=license_key,plan,status,expires_at,store_limit,email`;

  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Supabase HTTP ${res.status}`);
  }

  const rows = await res.json();
  if (!rows || rows.length === 0) {
    return { valid: false, reason: 'invalid_key' };
  }

  const license = rows[0];

  if (license.status !== 'active') {
    return { valid: false, reason: 'inactive' };
  }

  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, plan: license.plan || 'standard' };
}

module.exports = { validateLicense };
