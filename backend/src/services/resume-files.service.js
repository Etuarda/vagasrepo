const { PDFParse } = require("pdf-parse");
const { prisma } = require("../lib/prisma");

const MAX_PDF_BYTES = 10 * 1024 * 1024;

async function extractPdfText(buffer) {
  let parser = null;
  try {
    parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return String(parsed.text || "").trim().slice(0, 50000);
  } catch (err) {
    console.warn("Falha ao extrair texto do PDF:", err.message);
    return "";
  } finally {
    if (parser) await parser.destroy();
  }
}

function serializeResumeFile(file) {
  return {
    id: file.id,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    extractedTextLength: file.extractedText?.length || 0,
    createdAt: file.createdAt,
  };
}

async function uploadResumeFile(userId, file) {
  if (!file) {
    const err = new Error("Envie um arquivo PDF");
    err.statusCode = 400;
    throw err;
  }

  if (file.mimetype !== "application/pdf") {
    const err = new Error("Apenas arquivos PDF são aceitos");
    err.statusCode = 400;
    throw err;
  }

  if (file.size > MAX_PDF_BYTES) {
    const err = new Error("O PDF deve ter no máximo 10MB");
    err.statusCode = 400;
    throw err;
  }

  const extractedText = await extractPdfText(file.buffer);
  const saved = await prisma.resumeFile.create({
    data: {
      userId,
      fileName: file.originalname || "curriculo.pdf",
      mimeType: file.mimetype,
      sizeBytes: file.size,
      content: file.buffer,
      extractedText,
    },
  });

  return serializeResumeFile(saved);
}

async function listResumeFiles(userId) {
  const rows = await prisma.resumeFile.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      extractedText: true,
      createdAt: true,
    },
  });

  return rows.map(serializeResumeFile);
}

async function getResumeFile(userId, id) {
  const file = await prisma.resumeFile.findFirst({
    where: { id, userId },
  });

  if (!file) {
    const err = new Error("Currículo PDF não encontrado");
    err.statusCode = 404;
    throw err;
  }

  return file;
}

async function deleteResumeFile(userId, id) {
  const result = await prisma.resumeFile.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    const err = new Error("Currículo PDF não encontrado");
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
