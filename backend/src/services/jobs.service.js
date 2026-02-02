const { prisma } = require("../lib/prisma");

function startOfDay(d) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d) {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function parseYMD(ymd) {
  // "YYYY-MM-DD" -> Date (local)
  const [y, m, d] = String(ymd).split("-").map((n) => Number(n));
  return new Date(y, m - 1, d);
}

async function listJobs(userId, { q, status, period, dateFrom, dateTo }) {
  const and = [];

  // A) Busca textual (case-insensitive)
  if (q) {
    and.push({
      OR: [
        { titulo: { contains: q, mode: "insensitive" } },
        { empresa: { contains: q, mode: "insensitive" } },
        { fase: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (status) and.push({ status });

  // B) Filtro por período
  // Observação: o modelo atual não possui createdAt; usamos o campo "data" (DateTime) como referência temporal.
  if (period === "last7" || period === "last30") {
    const days = period === "last7" ? 7 : 30;
    const now = new Date();
    const from = startOfDay(new Date(now.getTime() - days * 24 * 60 * 60 * 1000));
    and.push({ data: { gte: from } });
  } else if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = startOfDay(parseYMD(dateFrom));
    if (dateTo) range.lte = endOfDay(parseYMD(dateTo));
    and.push({ data: range });
  }

  return prisma.job.findMany({
    where: {
      userId,
      AND: and,
    },
    orderBy: { data: "desc" },
  });
}

async function createJob(userId, data) {
  return prisma.job.create({
    data: { ...data, userId },
  });
}

async function updateJob(userId, id, data) {
  const result = await prisma.job.updateMany({
    where: { id, userId },
    data,
  });

  if (result.count === 0) {
    const err = new Error("Vaga não encontrada");
    err.statusCode = 404;
    throw err;
  }

  return { message: "Atualizado" };
}

async function deleteJob(userId, id) {
  const result = await prisma.job.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    const err = new Error("Vaga não encontrada");
    err.statusCode = 404;
    throw err;
  }

  return { message: "Removido" };
}

module.exports = { listJobs, createJob, updateJob, deleteJob };
