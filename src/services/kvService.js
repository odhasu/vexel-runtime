const UPSTASH_URL   = process.env.KV_REST_API_URL   || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.KV_REST_API_TOKEN  || process.env.UPSTASH_REDIS_REST_TOKEN;
const KV_ENABLED    = !!(UPSTASH_URL && UPSTASH_TOKEN);
const UPSTASH_TIMEOUT_MS = Number(process.env.KV_HTTP_TIMEOUT_MS || 3000);
const UPSTASH_RETRY_COUNT = Math.max(0, Number(process.env.KV_HTTP_RETRY_COUNT || 1));
const KV_CACHE_TTL_MS = Math.max(0, Number(process.env.KV_CACHE_TTL_MS || 5000));

let licensesCache = { data: null, expiresAt: 0 };

const KV_KEYS = {
  licenses: 'vexel_licenses',
};

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function readCache(cache) {
  if (!cache.data || Date.now() >= cache.expiresAt) return null;
  return clone(cache.data);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  if (!err) return false;
  if (err.name === 'AbortError') return true;
  if (typeof err.statusCode === 'number') {
    return err.statusCode === 429 || err.statusCode >= 500;
  }
  return false;
}

async function upstashCmd(command) {
  let lastError;
  for (let attempt = 0; attempt <= UPSTASH_RETRY_COUNT; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTASH_TIMEOUT_MS);
    try {
      const res = await fetch(UPSTASH_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(command),
        signal: controller.signal,
      });

      if (!res.ok) {
        const error = new Error(`[KV] HTTP ${res.status}`);
        error.statusCode = res.status;
        throw error;
      }

      const data = await res.json();
      if (data.error) {
        const error = new Error(`[KV] ${data.error}`);
        error.statusCode = typeof data.status === 'number' ? data.status : undefined;
        throw error;
      }
      return data.result;
    } catch (err) {
      lastError = err;
      if (attempt < UPSTASH_RETRY_COUNT && isRetryableError(err)) {
        await sleep((attempt + 1) * 100);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error('[KV] Unknown Upstash error');
}

async function kvGetLicenses() {
  if (!KV_ENABLED) return [];

  const cached = readCache(licensesCache);
  if (cached) return cached;

  try {
    const raw = await upstashCmd(['GET', KV_KEYS.licenses]);
    const data = raw ? JSON.parse(raw) : [];
    if (KV_CACHE_TTL_MS > 0) {
      licensesCache = { data: clone(data), expiresAt: Date.now() + KV_CACHE_TTL_MS };
    }
    return data;
  } catch (e) {
    console.error('[KV] licenses read error:', e.message);
    return [];
  }
}

async function kvRateLimitIncrement(bucketKey, windowMs) {
  if (!KV_ENABLED) return null;
  try {
    const count = Number(await upstashCmd(['INCR', bucketKey]));
    if (count === 1) {
      await upstashCmd(['PEXPIRE', bucketKey, String(windowMs)]);
      return { count, ttlMs: windowMs };
    }
    const ttlMsRaw = await upstashCmd(['PTTL', bucketKey]);
    const ttlMs = Number(ttlMsRaw);
    return { count, ttlMs: ttlMs > 0 ? ttlMs : windowMs };
  } catch (e) {
    console.error('[KV] rate limit error:', e.message);
    return null;
  }
}

module.exports = {
  kvGetLicenses,
  kvRateLimitIncrement,
  KV_ENABLED,
};
