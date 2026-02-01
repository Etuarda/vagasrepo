const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const env = require("../config/env");
const { prisma } = require("../lib/prisma");

async function registerUser({ name, email, password }) {
  const userExists = await prisma.user.findUnique({ where: { email } });
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
  const user = await prisma.user.findUnique({ where: { email } });

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

  const token = jwt.sign({ id: user.id }, env.JWT_SECRET, { expiresIn: "1d" });
  return { token, user: { name: user.name, email: user.email } };
}

async function getMe(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
}

module.exports = { registerUser, loginUser, getMe };
