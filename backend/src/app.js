// src/app.js
require("dotenv").config(); // precisa rodar antes de ./config/env

const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const { errorHandler } = require("./middlewares/errorHandler");

const authRoutes = require("./routes/auth.routes");
const jobsRoutes = require("./routes/jobs.routes");

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

const devFallbackOrigins = [
  "http://127.0.0.1:5500",
  "http://localhost:5500",
];

const origins = allowedOrigins.length ? allowedOrigins : devFallbackOrigins;

const corsOptions = {
  origin: (origin, callback) => {
    // permite chamadas sem origin (ex: Postman, curl, Render healthcheck)
    if (!origin) return callback(null, true);

    if (origins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS bloqueado para: ${origin}`));
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: false, // true apenas se usar cookies
};

// Aplica CORS globalmente
app.use(cors(corsOptions));

// Garante que preflight use a MESMA configuração
app.options("*", cors(corsOptions));

/**
 * =========================
 * MIDDLEWARES
 * =========================
 */

app.use(express.json());

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
 * ROUTES
 * =========================
 */
app.use("/auth", authRoutes);
app.use("/jobs", jobsRoutes);

/**
 * =========================
 * ERROR HANDLER
 * =========================
 */
app.use(errorHandler);

module.exports = { app };