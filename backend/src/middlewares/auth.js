const jwt = require("jsonwebtoken");
const env = require("../config/env");
const sessionService = require("../services/session.service");

function cookieToken(header) {
  const cookies = String(header || "").split(";").map((part) => part.trim());
  const session = cookies.find((part) => part.startsWith("vagas_session="));
  return session ? decodeURIComponent(session.slice("vagas_session=".length)) : "";
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  const [scheme, bearerToken] = String(authHeader || "").split(" ");
  if (authHeader && (scheme !== "Bearer" || !bearerToken)) {
    return res.status(401).json({ error: "Formato de token invalido" });
  }
  const token = bearerToken || cookieToken(req.headers.cookie);
  if (!token) return res.status(401).json({ error: "Sessao nao fornecida" });

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    const active = await sessionService.validateSession(decoded.id, token);
    if (!active) return res.status(401).json({ error: "Sessao invalida" });
    req.userId = decoded.id;
    req.token = token;
    return next();
  } catch {
    return res.status(401).json({ error: "Token invalido" });
  }
}

module.exports = { authMiddleware, cookieToken };
