const { PDFParse } = require("pdf-parse");
const { prisma } = require("../lib/prisma");
const profileService = require("./profile.service");

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

const KNOWN_SKILLS = [
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "Express",
  "PostgreSQL",
  "Prisma",
  "SQL",
  "Python",
  "Power BI",
  "Excel",
  "HTML",
  "CSS",
  "Tailwind",
  "Git",
  "Docker",
  "AWS",
  "Scrum",
  "Kanban",
  "REST",
  "API",
  "Frontend",
  "Backend",
  "Fullstack",
  "Dados",
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function parseResumeProfile(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const joined = lines.join(" ");
  const email = joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const contactLine = lines.find((line) => line.includes("@")) || joined;
  const phone =
    contactLine
      .match(/(?:\+?55\s*)?\(?\d{2}\)?\s*\d{4,5}\s*[-.]?\s*\d{4}/)?.[0]
      ?.replace(/\s*-\s*/g, "-")
      .replace(/\s+/g, " ") || "";
  const linkedinRaw = joined.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s|,;]+/i)?.[0] || "";
  const githubRaw = joined.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/[^\s|,;]+/i)?.[0] || "";
  const linkedin = linkedinRaw && !/^https?:\/\//i.test(linkedinRaw) ? `https://${linkedinRaw}` : linkedinRaw;
  const github = githubRaw && !/^https?:\/\//i.test(githubRaw) ? `https://${githubRaw}` : githubRaw;
  const firstLine = lines.find((line) => !line.includes("@") && line.length >= 5 && line.length <= 80) || "";
  const titleLine = lines.find((line) => /frontend|backend|fullstack|dados|data|developer|desenvolvedor|desenvolvedora|analista/i.test(line)) || "";
  const normalizedTitle = normalize(titleLine);
  const title =
    normalizedTitle.includes("backend")
      ? "Desenvolvedora Backend"
      : normalizedTitle.includes("frontend")
        ? "Desenvolvedora Frontend"
        : normalizedTitle.includes("fullstack")
          ? "Desenvolvedora Fullstack"
          : normalizedTitle.includes("dados") || normalizedTitle.includes("data")
            ? "Profissional de Dados"
            : titleLine.slice(0, 120);
  const summaryStart = lines.findIndex((line) => /resumo|perfil|objetivo|sobre/i.test(line));
  const summary =
    summaryStart >= 0
      ? lines.slice(summaryStart + 1, summaryStart + 5).join(" ").slice(0, 1200)
      : lines.slice(1, 5).join(" ").slice(0, 1200);
  const normalizedText = normalize(joined);
  const skills = KNOWN_SKILLS.filter((skill) => normalizedText.includes(normalize(skill)));
  const experienceStart = lines.findIndex((line) => /^(experi[êe]ncia profissional|experi[êe]ncias|hist[oó]rico profissional|atua[cç][aã]o)$/i.test(line));
  const experienceEnd =
    experienceStart >= 0
      ? lines.findIndex((line, index) => index > experienceStart && /^(educa[cç][aã]o|forma[cç][aã]o|forma[cç][aã]o acadêmica|habilidades|skills|projetos|certifica[cç][oõ]es)$/i.test(line))
      : -1;
  const experienceLines =
    experienceStart >= 0
      ? lines.slice(experienceStart + 1, experienceEnd > experienceStart ? experienceEnd : experienceStart + 9)
      : [];
  const experienceDescription = experienceLines.join(" ").slice(0, 1800);
  const experienceHead = experienceLines.find((line) => /\||:/.test(line)) || "";
  const experienceMatch = experienceHead.match(/^(.+?)\s*\|\s*(.+?):\s*(.+)$/);
  const experiences = experienceDescription
    ? [
        {
          role: experienceMatch?.[1]?.trim() || title || "Experiência profissional",
          company: experienceMatch?.[2]?.trim() || "Extraído do currículo",
          period: experienceMatch?.[3]?.trim() || "Informado no currículo",
          description: experienceLines.slice(experienceMatch ? 1 : 0).join(" ").slice(0, 1800) || experienceDescription,
        },
      ]
    : [];

  return {
    name: firstLine,
    title,
    emailContact: email,
    phone,
    linkedin,
    github,
    summary,
    skills,
    experiences,
  };
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

async function uploadResumeFile(userId, file, profileId = null) {
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
  const profile = await profileService.resolveProfile(userId, profileId);
  const saved = await prisma.resumeFile.create({
    data: {
      userId,
      profileId: profile.id,
      fileName: file.originalname || "curriculo.pdf",
      mimeType: file.mimetype,
      sizeBytes: file.size,
      content: file.buffer,
      extractedText,
    },
  });

  const extractedProfile = parseResumeProfile(extractedText);
  const updatedProfile = await profileService.updateProfileFromPdf(userId, profile.id, extractedProfile);

  return { ...serializeResumeFile(saved), profile: updatedProfile };
}

async function listResumeFiles(userId, profileId = null) {
  const profile = await profileService.resolveProfile(userId, profileId);
  const rows = await prisma.resumeFile.findMany({
    where: { userId, profileId: profile.id },
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
  parseResumeProfile,
};
