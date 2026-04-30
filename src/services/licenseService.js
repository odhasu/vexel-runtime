const normalizeDomain = require('../utils/domainNorm');
const { kvGetLicenses } = require('./kvService');

async function validateLicense(licenseKey, domain) {
  try {
    const licenses = await kvGetLicenses();
    const license = licenses.find(l => l.license_key === licenseKey && l.active);
    if (!license) return { valid: false, reason: 'invalid_key' };

    if (license.expires_at && new Date(license.expires_at) < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    if (license.domain !== '*') {
      const normalizedDomain = normalizeDomain(domain);
      const licenseDomain = normalizeDomain(license.domain);
      const permanentDomain = normalizeDomain(license.permanent_domain);

      if (normalizedDomain !== licenseDomain && normalizedDomain !== permanentDomain) {
        return { valid: false, reason: 'domain_mismatch' };
      }
    }

    return { valid: true, plan: license.plan || 'standard' };
  } catch (e) {
    console.error('[License] validateLicense error:', e.message);
    throw e;
  }
}

module.exports = { validateLicense };
