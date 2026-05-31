const { prisma } = require("../lib/prisma");
const cache = require("../lib/cache");
const { linkedJobInclude } = require("../modules/application-tracking/application-tracking.service");
const { recordApplicationStatusHistory } = require("../modules/application-tracking/application-history.service");
const {
  normalizeJobStatusAndPhase,
  assertCanUpdateClosedJob,
  phaseToAnalysisStatus,
} = require("../constants/application-status");
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
  const [y, m, d] = String(ymd).split("-").map((n) => Number(n));
  return new Date(y, m - 1, d);
}

async function listJobs(userId, filters = {}) {
  const variant = JSON.stringify({
    q: filters.q || "",
    titulo: filters.titulo || "",
    empresa: filters.empresa || "",
    linkVaga: filters.linkVaga || "",
    status: filters.status || "",
    fase: filters.fase || "",
    subprofileId: filters.subprofileId || "",
    origin: filters.origin || "",
    period: filters.period || "",
    dateFrom: filters.dateFrom || "",
    dateTo: filters.dateTo || "",
    limit: filters.limit || 50,
    cursor: filters.cursor || "",
  });
  return cache.remember("jobs", userId, variant, () => loadJobs(userId, filters));
}

async function loadJobs(userId, {
  q,
  titulo,
  empresa,
  linkVaga,
  status,
  fase,
  subprofileId,
  origin,
  period,
  dateFrom,
  dateTo,
  limit = 50,
  cursor,
}) {
  const and = [];

  if (q) {
    and.push({
      OR: [
        { titulo: { contains: q, mode: "insensitive" } },
        { empresa: { contains: q, mode: "insensitive" } },
        { linkVaga: { contains: q, mode: "insensitive" } },
        { fase: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  if (titulo) and.push({ titulo: { contains: titulo, mode: "insensitive" } });
  if (empresa) and.push({ empresa: { contains: empresa, mode: "insensitive" } });
  if (linkVaga) and.push({ linkVaga: { contains: linkVaga, mode: "insensitive" } });
  if (status) and.push({ status });
  if (fase) and.push({ fase });
  if (subprofileId) and.push({ jobAnalysis: { selectedSubprofileId: subprofileId } });
  if (origin === "matching") and.push({ jobAnalysisId: { not: null } });
  if (origin === "manual") and.push({ jobAnalysisId: null });

  if (period === "day") {
    const now = new Date();
    and.push({ data: { gte: startOfDay(now), lte: endOfDay(now) } });
  } else if (period === "week" || period === "last7") {
    const now = new Date();
    const from = startOfDay(new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000));
    and.push({ data: { gte: from } });
  } else if (period === "month" || period === "currentMonth") {
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    and.push({ data: { gte: from, lt: to } });
  } else if (period === "last30") {
    const now = new Date();
    const from = startOfDay(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    and.push({ data: { gte: from } });
  } else if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.gte = startOfDay(parseYMD(dateFrom));
    if (dateTo) range.lte = endOfDay(parseYMD(dateTo));
    and.push({ data: range });
  }

  return prisma.job.findMany({
    where: { userId, AND: and },
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
    const created = await tx.job.create({ data: { ...normalized, userId } });
    await recordApplicationStatusHistory(tx, {
      userId,
      jobId: created.id,
      novoStatus: created.status,
      novaFase: created.fase,
      observacao: "Cadastro inicial da candidatura.",
    });
    return created;
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
    const err = new Error("Vaga nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  return job;
}

async function updateJob(userId, id, data) {
  const normalized = normalizeJobStatusAndPhase(data);
  const existing = await prisma.job.findFirst({ where: { id, userId } });
  if (!existing) {
    const err = new Error("Vaga nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  assertCanUpdateClosedJob(existing, normalized);
  const nextStatus = normalized.status ?? existing.status;
  const nextPhase = normalized.fase ?? existing.fase;

  const job = await prisma.$transaction(async (tx) => {
    await tx.job.updateMany({ where: { id: existing.id, userId }, data: normalized });
    await recordApplicationStatusHistory(tx, {
      userId,
      jobId: existing.id,
      statusAnterior: existing.status,
      novoStatus: nextStatus,
      faseAnterior: existing.fase,
      novaFase: nextPhase,
      observacao: normalized.notes || "",
    });
    const updated = await tx.job.findFirst({ where: { id: existing.id, userId }, include: linkedJobInclude });
    const analysisStatus = phaseToAnalysisStatus(nextPhase);
    if (updated.jobAnalysisId && analysisStatus && tx.jobAnalysis?.updateMany) {
      await tx.jobAnalysis.updateMany({
        where: { id: updated.jobAnalysisId, userId },
        data: {
          status: analysisStatus,
          ...(analysisStatus === "Aplicada" ? { appliedAt: new Date() } : {}),
        },
      });
    }
    return updated;
  });

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
  const result = await prisma.job.deleteMany({ where: { id, userId } });

  if (result.count === 0) {
    const err = new Error("Vaga nao encontrada");
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
