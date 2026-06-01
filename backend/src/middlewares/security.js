const crypto = require("crypto");
const redis = require("../lib/redis");

const buckets = new Map();
const metrics = {
  requests: 0,
  errors: 0,
  slowRequests: 0,
  durationMs: 0,
};

function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  if (req.path.startsWith("/auth/")) res.setHeader("Cache-Control", "no-store");
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
    metrics.requests += 1;
    metrics.durationMs += durationMs;
    if (res.statusCode >= 500) metrics.errors += 1;
    if (durationMs > 1000) metrics.slowRequests += 1;

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
      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", Math.max(0, max - redisCount));
      res.setHeader("RateLimit-Reset", ttlSeconds);
      if (redisCount > max) {
        res.setHeader("Retry-After", ttlSeconds);
        return res.status(429).json({ error: "Muitas tentativas. Aguarde e tente novamente." });
      }
      return next();
    }

    const current = buckets.get(key);

    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader("RateLimit-Limit", max);
      res.setHeader("RateLimit-Remaining", max - 1);
      res.setHeader("RateLimit-Reset", ttlSeconds);
      return next();
    }

    current.count += 1;
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - current.count));
    res.setHeader("RateLimit-Reset", Math.ceil((current.resetAt - now) / 1000));
    if (current.count > max) {
      res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ error: "Muitas tentativas. Aguarde e tente novamente." });
    }

    return next();
  };
}

function metricsEndpoint(req, res) {
  const expectedToken = process.env.METRICS_TOKEN;
  if (expectedToken) {
    const providedToken = req.headers["x-metrics-token"] || req.query?.token;
    if (providedToken !== expectedToken) {
      return res.status(401).type("text/plain").send("Unauthorized\n");
    }
  }

  const averageDuration = metrics.requests ? metrics.durationMs / metrics.requests : 0;
  res.type("text/plain").send([
    "# HELP vagas_http_requests_total Total HTTP requests.",
    "# TYPE vagas_http_requests_total counter",
    `vagas_http_requests_total ${metrics.requests}`,
    "# HELP vagas_http_errors_total Total HTTP 5xx responses.",
    "# TYPE vagas_http_errors_total counter",
    `vagas_http_errors_total ${metrics.errors}`,
    "# HELP vagas_http_slow_requests_total Requests slower than one second.",
    "# TYPE vagas_http_slow_requests_total counter",
    `vagas_http_slow_requests_total ${metrics.slowRequests}`,
    "# HELP vagas_http_duration_average_ms Mean HTTP response duration.",
    "# TYPE vagas_http_duration_average_ms gauge",
    `vagas_http_duration_average_ms ${averageDuration.toFixed(2)}`,
    "",
  ].join("\n"));
}

module.exports = { securityHeaders, requestContext, rateLimit, metricsEndpoint };
