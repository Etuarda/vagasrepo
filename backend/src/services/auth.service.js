const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { prisma } = require("../lib/prisma");
const sessionService = require("./session.service");

const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;

async function registerUser({ name, email, password }) {
  const userExists = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (userExists) {
    const err = new Error("E-mail já cadastrado");
    err.statusCode = 400;
    throw err;
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { name, email, password: hashedPassword },
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

  const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });
  await sessionService.createSession(
    user.id,
    token,
    new Date(Date.now() + ACCESS_TOKEN_TTL_SECONDS * 1000)
  );
  return { token, user: { name: user.name, email: user.email } };
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
      linkedin: true,
      github: true,
      lattes: true,
      summary: true,
    },
  });
}

module.exports = { registerUser, loginUser, logoutUser, getMe };
