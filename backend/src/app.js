// src/app.js
require("dotenv").config(); // precisa rodar antes de ./config/env

const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const { prisma } = require("./lib/prisma");
const redis = require("./lib/redis");
const { HOSTED_FRONTEND_ORIGINS, createOriginMatcher } = require("./config/cors");
const { errorHandler } = require("./middlewares/errorHandler");
const { securityHeaders, requestContext, rateLimit, metricsEndpoint } = require("./middlewares/security");

const authRoutes = require("./routes/auth.routes");
const jobsRoutes = require("./routes/jobs.routes");
const profileRoutes = require("./routes/profile.routes");
const resumeFilesRoutes = require("./routes/resume-files.routes");
const billingRoutes = require("./routes/billing.routes");
const supportRoutes = require("./routes/support.routes");

const app = express();
app.set("trust proxy", 1);

/**
 * =========================
 * CORS CONFIG
 * =========================
 * - Lê múltiplas origens via env (separadas por vírgula)
 * - Fallback para dev local
 * - Permite ferramentas sem origin (Postman, curl, healthcheck Render)
 */

const allowedOrigins = (env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const devFallbackOrigins =
  env.NODE_ENV === "production"
    ? []
    : [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
      ];

const origins = [...new Set([...HOSTED_FRONTEND_ORIGINS, ...allowedOrigins, ...devFallbackOrigins])];
const isAllowedOrigin = createOriginMatcher(origins);

console.log(JSON.stringify({ event: "cors_init", origins, CORS_ORIGIN: env.CORS_ORIGIN ?? null }));

const corsOptions = {
  origin: (origin, callback) => {
    // permite chamadas sem origin (ex: Postman, curl, Render healthcheck)
    if (!origin) return callback(null, true);

    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    const err = new Error(`CORS bloqueado para: ${origin}`);
    err.statusCode = 403;
    return callback(err);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, keyPrefix: "auth" });
const passwordLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, keyPrefix: "password" });
const heavyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, keyPrefix: "heavy" });
const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, keyPrefix: "api" });

// Aplica CORS globalmente
app.use(requestContext);
app.use(securityHeaders);
app.use(cors(corsOptions));

// Garante que preflight use a MESMA configuração
app.options("*", cors(corsOptions));

/**
 * =========================
 * HEALTHCHECK
 * =========================
 */
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/metrics", metricsEndpoint);

app.get("/ready", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const cache = env.REDIS_URL ? (await redis.ping() ? "redis_ready" : "degraded_local") : "local_only";
    return res.json({ ok: true, database: "ready", cache });
  } catch (err) {
    return res.status(503).json({ ok: false, database: "unavailable" });
  }
});

/**
 * =========================
 * MIDDLEWARES
 * =========================
 */

app.use(apiLimiter);
app.use(express.json({ limit: "1mb" }));

/**
 * =========================
 * ROUTES
 * =========================
 */
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/auth/forgot-password", passwordLimiter);
app.use("/auth/reset-password", passwordLimiter);
app.use("/auth", authRoutes);
app.use("/billing", billingRoutes);
app.use("/support", supportRoutes);
app.use("/jobs", jobsRoutes);
app.use("/resume-files", heavyLimiter, resumeFilesRoutes);
app.use("/match", heavyLimiter);
app.use("/", profileRoutes);

/**
 * =========================
 * ERROR HANDLER
 * =========================
 */
app.use(errorHandler);

module.exports = { app };
