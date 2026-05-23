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
  "Java",
  "Spring",
  "Next.js",
  "Vue",
  "Angular",
  "MongoDB",
  "MySQL",
  "Redis",
  "Kubernetes",
  "CI/CD",
  "Linux",
  "Figma",
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function cleanLine(value) {
  return String(value || "")
    .replace(/^[\s\-–—•*]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SECTION_NAMES = [
  "resumo",
  "resumo profissional",
  "perfil",
  "objetivo",
  "sobre",
  "formacao",
  "formacao academica",
  "educacao",
  "projetos",
  "experiencia",
  "experiencias",
  "experiencia profissional",
  "historico profissional",
  "habilidades",
  "skills",
  "competencias",
  "cursos",
  "formacao complementar",
  "certificacoes",
  "certificados",
  "idiomas",
  "languages",
];

function isSectionTitle(line) {
  return SECTION_NAMES.includes(normalize(line).replace(/:$/, ""));
}

function getSection(lines, names) {
  const normalizedNames = names.map(normalize);
  const start = lines.findIndex((line) => normalizedNames.includes(normalize(line).replace(/:$/, "")));
  if (start < 0) return [];
  const end = lines.findIndex((line, index) => index > start && isSectionTitle(line));
  return lines.slice(start + 1, end > start ? end : undefined).map(cleanLine).filter(Boolean);
}

function looksLikeHeader(line) {
  return (
    /\|/.test(line) ||
    /\b(19|20)\d{2}\b/.test(line) ||
    /\b(atual|presente|current)\b/i.test(line) ||
    /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^.!?]{3,120}$/.test(line)
  );
}

function splitEntries(lines) {
  const entries = [];
  let current = [];

  lines.forEach((line) => {
    if (looksLikeHeader(line) && current.length) {
      entries.push(current);
      current = [line];
      return;
    }
    current.push(line);
  });

  if (current.length) entries.push(current);
  return entries.filter((entry) => entry.some(Boolean));
}

function compactDescription(lines, limit = 900) {
  return lines.map(cleanLine).filter(Boolean).join(" ").replace(/\s+/g, " ").slice(0, limit);
}

function extractPeriod(value) {
  const text = String(value || "");
  return (
    text.match(/(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s*\/?\s*\d{4}\s*(?:-|–|—|a|até)\s*(?:atual|presente|current|(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-zç]*\.?\s*\/?\s*\d{4}|\d{4})/i)?.[0] ||
    text.match(/\b(19|20)\d{2}\s*(?:-|–|—|a|até)\s*(?:atual|presente|current|(19|20)\d{2})\b/i)?.[0] ||
    text.match(/\b(19|20)\d{2}\b/)?.[0] ||
    ""
  );
}

function extractTechnologies(text) {
  const normalizedText = normalize(text);
  return KNOWN_SKILLS.filter((skill) => normalizedText.includes(normalize(skill)));
}

function splitHeaderParts(header) {
  return String(header || "")
    .split(/\s+\|\s+|\s+–\s+|\s+—\s+|\s+-\s+/)
    .map(cleanLine)
    .filter(Boolean);
}

function parseExperiences(lines, fallbackTitle) {
  return uniqueBy(
    splitEntries(lines)
      .map((entry) => {
        const header = entry[0] || "";
        const parts = splitHeaderParts(header);
        const period = extractPeriod(header) || extractPeriod(entry.join(" "));
        const role = parts[0] || fallbackTitle || "Experiencia profissional";
        const company = parts.find((part, index) => index > 0 && !extractPeriod(part)) || "";
        const description = compactDescription(entry.slice(1).length ? entry.slice(1) : entry, 1000);
        return {
          role,
          company: company || "Informado no curriculo",
          period: period || "Informado no curriculo",
          description,
        };
      })
      .filter((item) => item.description.length >= 10),
    (item) => `${normalize(item.role)}|${normalize(item.company)}|${normalize(item.description.slice(0, 60))}`
  ).slice(0, 8);
}

function normalizeUrl(value) {
  return value && !/^https?:\/\//i.test(value) ? `https://${value}` : value;
}

function parseProjects(lines) {
  return uniqueBy(
    splitEntries(lines)
      .map((entry) => {
        const header = entry[0] || "";
        const links = entry.join(" ").match(/(?:https?:\/\/)?(?:www\.)?[^\s|,;]+\.[^\s|,;]+\/?[^\s|,;]*/gi) || [];
        const repositoryUrl = links.find((link) => /github|gitlab|bitbucket/i.test(link)) || "";
        const deployUrl = links.find((link) => !/github|gitlab|bitbucket/i.test(link)) || "";
        return {
          title: splitHeaderParts(header)[0] || "Projeto",
          description: compactDescription(entry.slice(1).length ? entry.slice(1) : entry, 1000),
          repositoryUrl: normalizeUrl(repositoryUrl),
          deployUrl: normalizeUrl(deployUrl),
          technologies: extractTechnologies(entry.join(" ")),
        };
      })
      .filter((item) => item.title && item.description.length >= 10),
    (item) => `${normalize(item.title)}|${normalize(item.description.slice(0, 60))}`
  ).slice(0, 8);
}

function parseCourses(lines) {
  return uniqueBy(
    lines
      .map((line) => {
        const parts = splitHeaderParts(line);
        return {
          title: (parts[0] || line).slice(0, 180),
          institution: (parts[1] || "").slice(0, 180),
          period: extractPeriod(line).slice(0, 120),
          description: line.match(/\b\d+\s*h(?:oras)?\b/i)?.[0] || "",
        };
      })
      .filter((item) => item.title.length >= 2),
    (item) => normalize(`${item.title}|${item.institution}|${item.period}`)
  ).slice(0, 10);
}

function parseCertifications(lines) {
  return uniqueBy(
    lines
      .map((line) => {
        const parts = splitHeaderParts(line);
        const link = line.match(/(?:https?:\/\/)?[^\s|,;]+\.[^\s|,;]+\/?[^\s|,;]*/i)?.[0] || "";
        return {
          title: (parts[0] || line).slice(0, 180),
          issuer: (parts[1] || "").slice(0, 180),
          period: extractPeriod(line).slice(0, 120),
          credentialUrl: normalizeUrl(link),
        };
      })
      .filter((item) => item.title.length >= 2),
    (item) => normalize(`${item.title}|${item.issuer}|${item.period}`)
  ).slice(0, 10);
}

function parseLanguages(lines) {
  const known = {
    portugues: "Portugues",
    ingles: "Ingles",
    espanhol: "Espanhol",
    frances: "Frances",
    alemao: "Alemao",
    italiano: "Italiano",
  };

  return uniqueBy(
    lines
      .flatMap((line) => line.split(/[,;]+/))
      .map(cleanLine)
      .map((line) => {
        const normalized = normalize(line);
        const key = Object.keys(known).find((language) => normalized.includes(language));
        if (!key) return null;
        const level =
          line.match(/\b(basico|intermediario|avancado|fluente|nativo|iniciante|basic|intermediate|advanced|fluent)\b/i)?.[0] || "";
        return { name: known[key], level };
      })
      .filter(Boolean),
    (item) => normalize(`${item.name}|${item.level}`)
  );
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
  const courseStart = lines.findIndex((line) => /^(cursos|forma[cç][aã]o complementar|educa[cç][aã]o complementar)$/i.test(line));
  const courseEnd =
    courseStart >= 0
      ? lines.findIndex((line, index) => index > courseStart && /^(certifica[cç][oõ]es|habilidades|skills|projetos|experi[êe]ncia profissional)$/i.test(line))
      : -1;
  const courseLines =
    courseStart >= 0
      ? lines.slice(courseStart + 1, courseEnd > courseStart ? courseEnd : courseStart + 8)
      : [];
  const courses = courseLines.slice(0, 6).map((line) => ({
    title: line.slice(0, 180),
    institution: "",
    period: "",
    description: "",
  }));
  const certStart = lines.findIndex((line) => /^(certifica[cç][oõ]es|certificados)$/i.test(line));
  const certEnd =
    certStart >= 0
      ? lines.findIndex((line, index) => index > certStart && /^(habilidades|skills|projetos|experi[êe]ncia profissional|cursos)$/i.test(line))
      : -1;
  const certLines =
    certStart >= 0
      ? lines.slice(certStart + 1, certEnd > certStart ? certEnd : certStart + 8)
      : [];
  const certifications = certLines.slice(0, 6).map((line) => ({
    title: line.slice(0, 180),
    issuer: "",
    period: "",
    credentialUrl: "",
  }));

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
    courses,
    certifications,
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
