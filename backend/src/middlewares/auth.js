const jwt = require("jsonwebtoken");
const env = require("../config/env");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "Token não fornecido" });

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.userId = decoded.id;
    return next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

module.exports = { authMiddleware };
