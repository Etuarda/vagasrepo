const jwt = require("jsonwebtoken");
const env = require("../config/env");
const sessionService = require("../services/session.service");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token nao fornecido" });

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Formato de token invalido" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const active = await sessionService.validateSession(decoded.id, token);
    if (!active) return res.status(401).json({ error: "Sessao invalida" });
    req.userId = decoded.id;
    req.token = token;
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido" });
  }
}

module.exports = { authMiddleware };
