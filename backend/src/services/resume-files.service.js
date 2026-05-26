const { prisma } = require("../lib/prisma");
const { PDFDocument } = require("pdf-lib");
const cache = require("../lib/cache");
const profileService = require("./profile.service");

const MAX_PDF_BYTES = 3 * 1024 * 1024;

function hasPdfSignature(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) return false;
  const header = buffer.subarray(0, 5).toString("ascii");
  const trailer = buffer.subarray(Math.max(0, buffer.length - 2048)).toString("ascii");
  return header === "%PDF-" && trailer.includes("%%EOF");
}

async function assertValidPdf(buffer) {
  if (!hasPdfSignature(buffer)) {
    const err = new Error("Arquivo enviado nao e um PDF valido");
    err.statusCode = 400;
    throw err;
  }
  try {
    await PDFDocument.load(buffer, { updateMetadata: false });
  } catch (cause) {
    const err = new Error("Arquivo enviado nao e um PDF valido");
    err.statusCode = 400;
    throw err;
  }
}

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
  await assertValidPdf(file.buffer);

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

  await cache.invalidate("resume-files", userId);
  return serializeResumeFile(saved);
}

async function listResumeFiles(userId, profileId = null) {
  return cache.remember("resume-files", userId, profileId || "default", async () => {
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
  });
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
  await cache.invalidate("resume-files", userId);
  return { message: "Removido" };
}

module.exports = {
  uploadResumeFile,
  listResumeFiles,
  getResumeFile,
  deleteResumeFile,
  hasPdfSignature,
  assertValidPdf,
};
