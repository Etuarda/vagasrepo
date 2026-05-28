const { prisma } = require("../lib/prisma");
const cache = require("../lib/cache");
const { linkedJobInclude } = require("../modules/application-tracking/application-tracking.service");
const subscriptionService = require("./subscription.service");

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

async function listJobs(userId, { q, status, period, dateFrom, dateTo, limit = 50, cursor }) {
  const variant = JSON.stringify({ q: q || "", status: status || "", period: period || "", dateFrom: dateFrom || "", dateTo: dateTo || "", limit, cursor: cursor || "" });
  return cache.remember("jobs", userId, variant, () => loadJobs(userId, { q, status, period, dateFrom, dateTo, limit, cursor }));
}

function normalizeJobStatusAndPhase(data) {
  if (data.fase === "Encerrada" || data.status === "Encerrada") {
    return { ...data, fase: "Encerrada", status: "Encerrada" };
  }
  return data;
}

function phaseToAnalysisStatus(fase) {
  if (["Currículo gerado", "Aplicada", "Entrevista", "Teste técnico", "Feedback", "Encerrada"].includes(fase)) {
    return fase;
  }
  return null;
}

async function loadJobs(userId, { q, status, period, dateFrom, dateTo, limit = 50, cursor }) {
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
  if (period === "currentMonth") {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    and.push({ data: { gte: from, lt: to } });
  } else if (period === "last7" || period === "last30") {
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
    orderBy: [{ data: "desc" }, { id: "desc" }],
    take: limit,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: linkedJobInclude,
  });
}

async function createJob(userId, data) {
  const normalized = normalizeJobStatusAndPhase(data);
  const job = await prisma.$transaction(async (tx) => {
    await subscriptionService.assertApplicationTrackingLimit(userId, tx);
    return tx.job.create({
      data: { ...normalized, userId },
    });
  });
  await Promise.all([
    cache.invalidate("jobs", userId),
    cache.invalidate("shared-jobs-board", "global"),
  ]);
  return job;
}

async function getJob(userId, id) {
  const job = await prisma.job.findFirst({ where: { id, userId }, include: linkedJobInclude });
  if (!job) {
    const err = new Error("Vaga não encontrada");
    err.statusCode = 404;
    throw err;
  }
  return job;
}

async function updateJob(userId, id, data) {
  const normalized = normalizeJobStatusAndPhase(data);
  const result = await prisma.job.updateMany({
    where: { id, userId },
    data: normalized,
  });

  if (result.count === 0) {
    const err = new Error("Vaga não encontrada");
    err.statusCode = 404;
    throw err;
  }

  const job = await prisma.job.findFirst({ where: { id, userId }, include: linkedJobInclude });
  const analysisStatus = phaseToAnalysisStatus(normalized.fase);
  if (job.jobAnalysisId && analysisStatus) {
    await prisma.jobAnalysis.updateMany({
      where: { id: job.jobAnalysisId, userId },
      data: {
        status: analysisStatus,
        ...(analysisStatus === "Aplicada" ? { appliedAt: new Date() } : {}),
      },
    });
  }
  await Promise.all([
    cache.invalidate("jobs", userId),
    cache.invalidate("shared-jobs-board", "global"),
    ...(job.jobAnalysisId ? [cache.invalidate("match-history", userId)] : []),
  ]);
  return { message: "Atualizado", job };
}

async function deleteJob(userId, id) {
  const linkedJob = await prisma.job.findFirst({
    where: { id, userId },
    select: { jobAnalysisId: true },
  });
  const result = await prisma.job.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    const err = new Error("Vaga não encontrada");
    err.statusCode = 404;
    throw err;
  }

  await Promise.all([
    cache.invalidate("jobs", userId),
    cache.invalidate("shared-jobs-board", "global"),
    ...(linkedJob?.jobAnalysisId ? [cache.invalidate("match-history", userId)] : []),
  ]);
  return { message: "Removido" };
}

module.exports = { listJobs, getJob, createJob, updateJob, deleteJob, normalizeJobStatusAndPhase };
