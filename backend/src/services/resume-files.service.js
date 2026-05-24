const { prisma } = require("../lib/prisma");
const profileService = require("./profile.service");

const MAX_PDF_BYTES = 3 * 1024 * 1024;

function serializeResumeFile(file) {
  return {
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    createdAt: file.createdAt,
  };
}

async function uploadResumeFile(userId, file, profileId = null) {
  if (!file) {
    const err = new Error("Envie um arquivo PDF");
    err.statusCode = 400;
    throw err;
  }
  if (file.mimetype !== "application/pdf") {
    const err = new Error("Apenas arquivos PDF sao aceitos");
    err.statusCode = 400;
    throw err;
  }
  if (file.size > MAX_PDF_BYTES) {
    const err = new Error("O PDF deve ter no maximo 3MB");
    err.statusCode = 400;
    throw err;
  }

  const profile = await profileService.resolveProfile(userId, profileId);
  const saved = await prisma.resumeFile.create({
    data: {
      userId,
      profileId: profile.id,
      fileName: file.originalname || "curriculo.pdf",
      mimeType: file.mimetype,
      sizeBytes: file.size,
      content: file.buffer,
      // Campo legado mantido para compatibilidade com a migration existente; o MVP nao extrai texto.
      extractedText: "",
    },
  });

  return serializeResumeFile(saved);
}

async function listResumeFiles(userId, profileId = null) {
  const profile = await profileService.resolveProfile(userId, profileId);
  const rows = await prisma.resumeFile.findMany({
    where: { userId, profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  });
  return rows.map(serializeResumeFile);
}

async function getResumeFile(userId, id) {
  const file = await prisma.resumeFile.findFirst({ where: { id, userId } });
  if (!file) {
    const err = new Error("Curriculo PDF nao encontrado");
    err.statusCode = 404;
    throw err;
  }
  return file;
}

async function deleteResumeFile(userId, id) {
  const result = await prisma.resumeFile.deleteMany({ where: { id, userId } });
  if (!result.count) {
    const err = new Error("Curriculo PDF nao encontrado");
    err.statusCode = 404;
    throw err;
  }
  return { message: "Removido" };
}

module.exports = {
  uploadResumeFile,
  listResumeFiles,
  getResumeFile,
  deleteResumeFile,
};
