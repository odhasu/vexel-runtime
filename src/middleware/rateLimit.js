const { kvRateLimitIncrement } = require('../services/kvService');

const rateLimitBuckets = {};

function normalizeIp(ip) {
  if (!ip) return 'unknown';
  const value = String(ip).split(',')[0].trim();
  const safe = value.replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 64);
  return safe || 'unknown';
}

async function rateLimit(ip, endpoint = 'default', maxPerMinute = 60, windowMs = 60000) {
  const safeMaxPerMinute = Number.isFinite(maxPerMinute) ? Math.max(1, Math.floor(maxPerMinute)) : 60;
  const safeWindowMs = Number.isFinite(windowMs) ? Math.max(1000, Math.floor(windowMs)) : 60000;
  const safeEndpoint = String(endpoint || 'default').replace(/[^a-zA-Z0-9:_-]/g, '').slice(0, 64) || 'default';

  const normalizedIp = normalizeIp(ip);
  const key = `${normalizedIp}:${safeEndpoint}`;

  const kvResult = await kvRateLimitIncrement(`rl:${key}`, safeWindowMs);
  if (kvResult) {
    return kvResult.count <= safeMaxPerMinute;
  }

  const now = Date.now();
  const bucket = rateLimitBuckets[key];
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets[key] = { count: 1, resetAt: now + safeWindowMs };
    return true;
  }
  if (bucket.count >= safeMaxPerMinute) return false;
  bucket.count += 1;
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const key of Object.keys(rateLimitBuckets)) {
    if (now >= rateLimitBuckets[key].resetAt) delete rateLimitBuckets[key];
  }
}, 5 * 60 * 1000).unref();

module.exports = rateLimit;
