const crypto = require("crypto");
const redis = require("../lib/redis");

const buckets = new Map();

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  return next();
}

function requestContext(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = String(requestId).slice(0, 80);
  req.startedAt = Date.now();
  res.setHeader("X-Request-Id", req.requestId);

  res.on("finish", () => {
    const durationMs = Date.now() - req.startedAt;
    const log = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
    };

    if (res.statusCode >= 500) console.error(JSON.stringify(log));
    else if (durationMs > 1000 || res.statusCode >= 400) console.warn(JSON.stringify(log));
  });

  return next();
}

function rateLimit({ windowMs, max, keyPrefix = "default" }) {
  return async (req, res, next) => {
    const now = Date.now();
    if (buckets.size > 10000) {
      for (const [bucketKey, bucket] of buckets.entries()) {
        if (bucket.resetAt <= now) buckets.delete(bucketKey);
      }
    }
    const ip = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const key = `${keyPrefix}:${ip}`;
    const ttlSeconds = Math.ceil(windowMs / 1000);
    const redisCount = await redis.incrWithTtl(`rate:${key}`, ttlSeconds);

    if (redisCount !== null) {
      if (redisCount > max) {
        res.setHeader("Retry-After", ttlSeconds);
        return res.status(429).json({ error: "Muitas tentativas. Aguarde e tente novamente." });
      }
      return next();
    }

    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > max) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: "Muitas tentativas. Aguarde e tente novamente." });
    }

    return next();
  };
}

module.exports = { securityHeaders, requestContext, rateLimit };
