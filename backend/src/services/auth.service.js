const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { prisma } = require("../lib/prisma");
const { PLAN_KEYS } = require("../constants/subscription-plans");
const sessionService = require("./session.service");
const emailService = require("./email.service");

const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const PASSWORD_RESET_TTL_MINUTES = 30;
const PASSWORD_RESET_RESPONSE = "Se o e-mail estiver cadastrado, enviaremos um link de recuperacao.";

async function registerUser({ name, email, phone, password }) {
  const userExists = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (userExists) {
    const err = new Error("E-mail já cadastrado");
    err.statusCode = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      emailContact: email,
      password: hashedPassword,
      subscription: {
        create: { plan: PLAN_KEYS.FREE, status: "active" },
      },
    },
  });

  return { message: "Usuário criado" };
}

async function loginUser({ email, password }) {
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });

  if (!user) {
    const err = new Error("Credenciais inválidas");
    err.statusCode = 401;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    const err = new Error("Credenciais inválidas");
    err.statusCode = 401;
    throw err;
  }

  const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS, algorithm: "HS256" });
  await sessionService.createSession(
    user.id,
    token,
    new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000)
  );
  return { token, user: { name: user.name, email: user.email, phone: user.phone } };
}

async function requestPasswordReset({ email }) {
  const user = await prisma.user.findFirst({
    where: { email: { equals: email, mode: "insensitive" } },
    select: { id: true, name: true, email: true },
  });
  if (!user) return { message: PASSWORD_RESET_RESPONSE };

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sessionService.hashToken(token);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });
  const record = await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash, expiresAt },
  });

  try {
    const delivery = await emailService.sendPasswordResetEmail(user, token);
    return { message: PASSWORD_RESET_RESPONSE, ...delivery };
  } catch (err) {
    await prisma.passwordResetToken.delete({ where: { id: record.id } });
    throw err;
  }
}

async function resetPassword({ token, password }) {
  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash: sessionService.hashToken(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  });
  if (!record) {
    const err = new Error("Link de recuperacao invalido ou expirado");
    err.statusCode = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({
      where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (!consumed.count) {
      const err = new Error("Link de recuperacao invalido ou expirado");
      err.statusCode = 400;
      throw err;
    }
    await tx.user.update({ where: { id: record.userId }, data: { password: hashedPassword } });
  });
  await sessionService.revokeAllUserSessions(record.userId);
  return { message: "Senha redefinida. Entre novamente com sua nova senha." };
}

async function logoutUser(token) {
  await sessionService.revokeSession(token);
  return { message: "Sessao encerrada" };
}

async function getMe(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      emailContact: true,
      phone: true,
      location: true,
      cep: true,
      linkedin: true,
      github: true,
      lattes: true,
      summary: true,
    },
  });
}

module.exports = { registerUser, loginUser, requestPasswordReset, resetPassword, logoutUser, getMe };
