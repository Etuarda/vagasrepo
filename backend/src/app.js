// src/app.js
require("dotenv").config(); // precisa rodar antes de ./config/env

const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const { HOSTED_FRONTEND_ORIGINS, createOriginMatcher } = require("./config/cors");
const { errorHandler } = require("./middlewares/errorHandler");
const { securityHeaders, requestContext, rateLimit } = require("./middlewares/security");

const authRoutes = require("./routes/auth.routes");
const jobsRoutes = require("./routes/jobs.routes");
const profileRoutes = require("./routes/profile.routes");
const resumeFilesRoutes = require("./routes/resume-files.routes");

const app = express();

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
  credentials: false, // true apenas se usar cookies
};

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, keyPrefix: "auth" });
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
app.use("/auth", authRoutes);
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
