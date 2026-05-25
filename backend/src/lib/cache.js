const redis = require("./redis");

const DEFAULT_CACHE_TTL_SECONDS = 5 * 60;

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
    return null;
  }
}

async function write(key, value, ttlSeconds) {
  try {
    await redis.set(key, JSON.stringify(value), ttlSeconds);
  } catch (err) {
    // Cache failure must not fail the application request.
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
    // With Redis unavailable there is no shared cached value to invalidate.
  }
}

module.exports = { DEFAULT_CACHE_TTL_SECONDS, remember, invalidate };
