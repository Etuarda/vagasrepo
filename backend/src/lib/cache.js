const redis = require("./redis");

const DEFAULT_CACHE_TTL_SECONDS = 5 * 60;
const DEGRADATION_LOG_INTERVAL_MS = 60 * 1000;
const degradationLoggedAt = new Map();
const localValues = new Map();
const localVersions = new Map();
const inFlight = new Map();

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

function deleteLocalOwnerValues(namespace, owner) {
  const prefix = `cache:${part(namespace)}:${part(owner)}:`;
  for (const key of localValues.keys()) {
    if (key.startsWith(prefix)) localValues.delete(key);
  }
}

function pruneExpiredLocalValues() {
  if (localValues.size < 500) return;
  const now = Date.now();
  for (const [key, value] of localValues.entries()) {
    if (value.expiresAt <= now) localValues.delete(key);
  }
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
  const versionName = versionKey(namespace, owner);
  const version = (await read(versionName)) || String(localVersions.get(versionName) || 0);
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

  const local = localValues.get(key);
  if (local && local.expiresAt > Date.now()) return local.value;
  if (local) localValues.delete(key);

  if (inFlight.has(key)) return inFlight.get(key);
  const pending = (async () => {
    const value = await loader();
    pruneExpiredLocalValues();
    localValues.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    await write(key, value, ttlSeconds);
    return value;
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}

async function invalidate(namespace, owner) {
  const key = versionKey(namespace, owner);
  deleteLocalOwnerValues(namespace, owner);
  try {
    const version = await redis.incr(key);
    localVersions.set(key, version === null ? (localVersions.get(key) || 0) + 1 : Number(version));
  } catch (err) {
    logDegradation("invalidate", err);
    localVersions.set(key, (localVersions.get(key) || 0) + 1);
  }
}

module.exports = { DEFAULT_CACHE_TTL_SECONDS, remember, invalidate };
