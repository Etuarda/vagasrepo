const { prisma } = require("../lib/prisma");

async function listJobs(userId, { q, status, fase }) {
  return prisma.job.findMany({
    where: {
      userId,
      AND: [
        q
          ? {
              OR: [
                { titulo: { contains: q, mode: "insensitive" } },
                { empresa: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        status ? { status } : {},
        fase ? { fase } : {},
      ],
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
