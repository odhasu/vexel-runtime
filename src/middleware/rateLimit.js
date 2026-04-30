const rateLimitBuckets = {};

function normalizeIp(ip) {
  if (!ip) return 'unknown';
  const value = String(ip).split(',')[0].trim();
  const safe = value.replace(/[^a-zA-Z0-9:._-]/g, '').slice(0, 64);
  return safe || 'unknown';
}

async function rateLimit(ip, endpoint = 'default', maxPerMinute = 60, windowMs = 60000) {
  const normalizedIp = normalizeIp(ip);
  const key = `${normalizedIp}:${endpoint}`;
  const now = Date.now();

  const bucket = rateLimitBuckets[key];
  if (!bucket || now >= bucket.resetAt) {
    rateLimitBuckets[key] = { count: 1, resetAt: now + windowMs };
    return true;
  }
  if (bucket.count >= maxPerMinute) return false;
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
