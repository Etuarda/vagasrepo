const { registerSchema, loginSchema } = require("../schemas/auth.schema");
const authService = require("../services/auth.service");

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
    return res.json(out);
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

module.exports = { register, login, me };
