const redis = require("./redis");

const DEFAULT_CACHE_TTL_SECONDS = 5 * 60;
const DEGRADATION_LOG_INTERVAL_MS = 60 * 1000;
const degradationLoggedAt = new Map();

function logDegradation(operation, err) {
  const now = Date.now();
  if (now - (degradationLoggedAt.get(operation) || 0) < DEGRADATION_LOG_INTERVAL_MS) return;
  degradationLoggedAt.set(operation, now);
  console.warn(JSON.stringify({
    event: "cache_degraded",
    operation,
    error: err.message,
  }));
}

function part(value) {
  return encodeURIComponent(String(value || "default"));
}

function versionKey(namespace, owner) {
  return `cache-version:${part(namespace)}:${part(owner)}`;
}

function valueKey(namespace, owner, version, variant) {
  return `cache:${part(namespace)}:${part(owner)}:v${part(version)}:${part(variant)}`;
}

async function read(key) {
  try {
    return await redis.get(key);
  } catch (err) {
    logDegradation("read", err);
    return null;
  }
}

async function write(key, value, ttlSeconds) {
  try {
    await redis.set(key, JSON.stringify(value), ttlSeconds);
  } catch (err) {
    logDegradation("write", err);
  }
}

async function remember(namespace, owner, variant, loader, ttlSeconds = DEFAULT_CACHE_TTL_SECONDS) {
  const version = (await read(versionKey(namespace, owner))) || "0";
  const key = valueKey(namespace, owner, version, variant);
  const cached = await read(key);
  if (cached !== null) {
    try {
      return JSON.parse(cached);
    } catch (err) {
      try {
        await redis.del(key);
      } catch (deleteErr) {
        logDegradation("delete", deleteErr);
        // The database load below remains the authoritative fallback.
      }
    }
  }

  const value = await loader();
  await write(key, value, ttlSeconds);
  return value;
}

async function invalidate(namespace, owner) {
  try {
    await redis.incr(versionKey(namespace, owner));
  } catch (err) {
    logDegradation("invalidate", err);
  }
}

module.exports = { DEFAULT_CACHE_TTL_SECONDS, remember, invalidate };
