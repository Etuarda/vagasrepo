const env = require("../config/env");

let client = null;
let disabled = false;

async function getClient() {
  if (!env.REDIS_URL || disabled) return null;
  if (client) return client;

  try {
    const Redis = require("ioredis");
    client = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    });
    client.on("error", (err) => {
      disabled = true;
      console.warn(JSON.stringify({ event: "redis_disabled", error: err.message }));
    });
    await client.connect();
    return client;
  } catch (err) {
    disabled = true;
    console.warn(JSON.stringify({ event: "redis_unavailable", error: err.message }));
    return null;
  }
}

async function get(key) {
  const redis = await getClient();
  if (!redis) return null;
  return redis.get(key);
}

async function set(key, value, ttlSeconds) {
  const redis = await getClient();
  if (!redis) return false;
  if (ttlSeconds) await redis.set(key, value, "EX", ttlSeconds);
  else await redis.set(key, value);
  return true;
}

async function del(key) {
  const redis = await getClient();
  if (!redis) return false;
  await redis.del(key);
  return true;
}

async function incrWithTtl(key, ttlSeconds) {
  const redis = await getClient();
  if (!redis) return null;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, ttlSeconds);
  return count;
}

async function incr(key) {
  const redis = await getClient();
  if (!redis) return null;
  return redis.incr(key);
}

module.exports = { get, set, del, incr, incrWithTtl };
