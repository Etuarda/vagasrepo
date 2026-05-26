const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const SLOW_QUERY_MS = Number(process.env.SLOW_QUERY_MS || 500);

prisma.$use(async (params, next) => {
  const startedAt = Date.now();
  try {
    return await next(params);
  } finally {
    const durationMs = Date.now() - startedAt;
    if (durationMs >= SLOW_QUERY_MS) {
      console.warn(JSON.stringify({
        event: "slow_query",
        model: params.model || "raw",
        action: params.action,
        durationMs,
      }));
    }
  }
});

module.exports = { prisma, SLOW_QUERY_MS };
