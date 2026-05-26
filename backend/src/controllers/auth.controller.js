const { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } = require("../schemas/auth.schema");
const authService = require("../services/auth.service");

const SESSION_COOKIE = "vagas_session";
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

function cookieValue(token, maxAge, req) {
  const localCrossSite = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin || "");
  const sameSite = localCrossSite ? "None" : "Strict";
  const path = localCrossSite ? "/" : "/api";
  return `${SESSION_COOKIE}=${encodeURIComponent(token || "")}; Path=${path}; HttpOnly; Secure; SameSite=${sameSite}; Max-Age=${maxAge}`;
}

async function register(req, res, next) {
  try {
    const payload = registerSchema.parse(req.body);
    const out = await authService.registerUser(payload);
    return res.status(201).json(out);
  } catch (err) {
    return next(err);
  }
}

async function login(req, res, next) {
  try {
    const payload = loginSchema.parse(req.body);
    const out = await authService.loginUser(payload);
    res.setHeader("Set-Cookie", cookieValue(out.token, SESSION_MAX_AGE_SECONDS, req));
    return res.json({ user: out.user });
  } catch (err) {
    return next(err);
  }
}

async function me(req, res, next) {
  try {
    const user = await authService.getMe(req.userId);
    return res.json(user);
  } catch (err) {
    return next(err);
  }
}

async function forgotPassword(req, res, next) {
  try {
    const payload = forgotPasswordSchema.parse(req.body);
    const out = await authService.requestPasswordReset(payload);
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const payload = resetPasswordSchema.parse(req.body);
    const out = await authService.resetPassword(payload);
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res, next) {
  try {
    const out = await authService.logoutUser(req.token);
    res.setHeader("Set-Cookie", cookieValue("", 0, req));
    return res.json(out);
  } catch (err) {
    return next(err);
  }
}

module.exports = { register, login, forgotPassword, resetPassword, logout, me };
