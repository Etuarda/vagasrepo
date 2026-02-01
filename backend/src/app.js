// src/app.js
require("dotenv").config(); // TEM que rodar antes de ler ./config/env

const express = require("express");
const cors = require("cors");

const env = require("./config/env");
const { errorHandler } = require("./middlewares/errorHandler");

const authRoutes = require("./routes/auth.routes");
const jobsRoutes = require("./routes/jobs.routes");

const app = express();

// ---- CORS ----
// Aceita múltiplas origens separadas por vírgula no .env (CORS_ORIGIN)
// Ex: CORS_ORIGIN=http://127.0.0.1:5500,http://localhost:5500
const allowedOrigins = (env.CORS_ORIGIN || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// fallback seguro para dev local
const devFallbackOrigins = ["http://127.0.0.1:5500", "http://localhost:5500"];
const origins = allowedOrigins.length ? allowedOrigins : devFallbackOrigins;

app.use(
  cors({
    origin: (origin, cb) => {
      // permite ferramentas sem origin (curl/postman)
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS bloqueado para: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Preflight (OPTIONS) — essencial para o navegador não bloquear antes do POST
app.options("*", cors());

app.use(express.json());

// Healthcheck simples (ajuda muito no debug)
app.get("/health", (req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/jobs", jobsRoutes);

// Handler de erros por último
app.use(errorHandler);

module.exports = { app };
