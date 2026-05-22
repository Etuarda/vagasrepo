const { prisma } = require("../lib/prisma");
const profileService = require("./profile.service");

const TECH_KEYWORDS = [
  "javascript",
  "typescript",
  "react",
  "node",
  "express",
  "postgresql",
  "postgres",
  "prisma",
  "sql",
  "html",
  "css",
  "tailwind",
  "git",
  "docker",
  "aws",
  "api",
  "rest",
  "graphql",
  "python",
  "java",
];

const SKILL_KEYWORDS = [
  "comunicação",
  "liderança",
  "scrum",
  "agile",
  "kanban",
  "testes",
  "frontend",
  "backend",
  "fullstack",
  "clean code",
  "solid",
  "acessibilidade",
  "ui",
  "ux",
  "produto",
];

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function includesLoose(source, term) {
  const s = normalize(source);
  const t = normalize(term);
  return Boolean(t) && (s.includes(t) || t.includes(s));
}

function extractFromText(text, dictionary) {
  return dictionary.filter((item) => includesLoose(text, item));
}

function inferTitle(text) {
  const firstLine = String(text).split(/\r?\n/).find((line) => line.trim().length > 4);
  if (!firstLine) return "Vaga analisada";
  return firstLine.trim().slice(0, 120);
}

function compareRequired(required, owned) {
  const matched = [];
  const missing = [];

  required.forEach((item) => {
    const hasMatch = owned.some((ownedItem) => includesLoose(ownedItem, item));
    if (hasMatch) matched.push(item);
    else missing.push(item);
  });

  return { matched, missing };
}

function scorePercent(matched, total) {
  if (!total) return 100;
  return Math.round((matched / total) * 100);
}

async function executeMatch(userId, jobDescription) {
  const profile = await profileService.getProfile(userId);
  const text = jobDescription.trim();

  const requiredTechnologies = extractFromText(text, TECH_KEYWORDS);
  const requiredSkills = extractFromText(text, SKILL_KEYWORDS);

  const fallbackSkills = requiredSkills.length ? requiredSkills : ["comunicação", "resolução de problemas"];
  const fallbackTechs = requiredTechnologies.length ? requiredTechnologies : ["javascript", "html", "css"];

  const projectTechs = profile.projects.flatMap((project) => project.technologies);
  const ownedSkills = profile.skills;
  const ownedTechnologies = [...profile.skills, ...projectTechs];

  const skillMatch = compareRequired(fallbackSkills, ownedSkills);
  const techMatch = compareRequired(fallbackTechs, ownedTechnologies);

  const skillsScore = scorePercent(skillMatch.matched.length, fallbackSkills.length);
  const technologiesScore = scorePercent(techMatch.matched.length, fallbackTechs.length);

  const projectScores = profile.projects
    .map((project) => {
      const techMatches = fallbackTechs.filter((tech) =>
        project.technologies.some((projectTech) => includesLoose(projectTech, tech))
      );
      const skillMatches = fallbackSkills.filter((skill) =>
        includesLoose(`${project.title} ${project.description}`, skill)
      );
      const score = Math.min(100, Math.round((techMatches.length / fallbackTechs.length) * 80) + skillMatches.length * 10);

      return {
        project,
        score,
        reason: techMatches.length
          ? `Conecta com ${techMatches.join(", ")}.`
          : "Projeto relevante como evidência complementar do perfil.",
      };
    })
    .sort((a, b) => b.score - a.score);

  const selectedProjects = projectScores.slice(0, 2).map((item) => item.project);
  const hasProfileBase = profile.summary || profile.title || profile.experiences.length;
  const semanticScore = hasProfileBase ? 80 : 45;
  const totalScore = Math.round(skillsScore * 0.5 + technologiesScore * 0.35 + semanticScore * 0.15);

  const suggestedSummary =
    profile.summary ||
    `${profile.name} possui perfil em construção. Cadastre resumo, habilidades e projetos para gerar uma versão mais precisa.`;

  const result = {
    scoreDetails: {
      skillsMatchScore: skillsScore,
      technologiesMatchScore: technologiesScore,
      semanticMatchScore: semanticScore,
      totalScore,
    },
    score: totalScore,
    targetTitle: inferTitle(text),
    matchedSkills: skillMatch.matched,
    missingSkills: skillMatch.missing,
    matchedTechnologies: techMatch.matched,
    missingTechnologies: techMatch.missing,
    selectedProjects,
    projectScores,
    suggestedSummary,
    semanticFeedback: `A análise comparou ${fallbackSkills.length} competências e ${fallbackTechs.length} tecnologias com o perfil cadastrado.`,
  };

  const saved = await prisma.optimizedResume.create({
    data: {
      userId,
      targetTitle: result.targetTitle,
      jobDescription: text,
      score: totalScore,
      suggestedSummary,
      selectedProjects,
      matchedSkills: result.matchedSkills,
      missingSkills: result.missingSkills,
      matchedTechnologies: result.matchedTechnologies,
      missingTechnologies: result.missingTechnologies,
    },
  });

  return { ...result, id: saved.id, savedAt: saved.createdAt };
}

async function listHistory(userId) {
  return prisma.optimizedResume.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      targetTitle: true,
      score: true,
      createdAt: true,
    },
  });
}

async function deleteHistory(userId, id) {
  const result = await prisma.optimizedResume.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    const err = new Error("Versão otimizada não encontrada");
    err.statusCode = 404;
    throw err;
  }
  return { message: "Removido" };
}

module.exports = { executeMatch, listHistory, deleteHistory };
