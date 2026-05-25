const crypto = require("crypto");
const { prisma } = require("../lib/prisma");
const redis = require("../lib/redis");

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function ttlSeconds(expiresAt) {
  return Math.max(1, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

async function createSession(userId, token, expiresAt) {
  const tokenHash = hashToken(token);
  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });
  await redis.set(`session:${tokenHash}`, userId, ttlSeconds(expiresAt));
  return tokenHash;
}

async function validateSession(userId, token) {
  const tokenHash = hashToken(token);
  const cachedUserId = await redis.get(`session:${tokenHash}`);
  if (cachedUserId === userId) return true;

  const session = await prisma.authSession.findFirst({
    where: {
      userId,
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { expiresAt: true },
  });

  if (!session) return false;
  await redis.set(`session:${tokenHash}`, userId, ttlSeconds(session.expiresAt));
  return true;
}

async function revokeSession(token) {
  const tokenHash = hashToken(token);
  await prisma.authSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await redis.del(`session:${tokenHash}`);
}

async function revokeAllUserSessions(userId) {
  const sessions = await prisma.authSession.findMany({
    where: { userId, revokedAt: null },
    select: { tokenHash: true },
  });
  await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await Promise.all(sessions.map((session) => redis.del(`session:${session.tokenHash}`)));
}

module.exports = { createSession, validateSession, revokeSession, revokeAllUserSessions, hashToken };
