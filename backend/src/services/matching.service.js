const { prisma } = require("../lib/prisma");
const cache = require("../lib/cache");
const profileService = require("./profile.service");
const { generateOptimizedResumePdf } = require("./pdf-output.service");
const { classifyJob, normalizeTerm } = require("../modules/matching/keyword-normalizer");
const { rankProjects } = require("../modules/matching/project-ranking.service");
const { compileResume } = require("../modules/resume/resume-compiler.service");
const { createSharedMatchedJob } = require("../modules/matching/shared-matched-jobs.service");

const MATCH_HISTORY_RETENTION_DAYS = 30;
const MATCH_HISTORY_PURGE_INTERVAL_MS = 60 * 60 * 1000;
const nextHistoryPurgeByUser = new Map();

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function historyRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - MATCH_HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

async function purgeExpiredHistory(userId, now = new Date()) {
  const cutoff = historyRetentionCutoff(now);
  await prisma.jobAnalysis.deleteMany({ where: { userId, createdAt: { lt: cutoff } } });
  await prisma.optimizedResume.deleteMany({
    where: {
      userId,
      createdAt: { lt: cutoff },
      generatedForAnalyses: { none: {} },
    },
  });
  return cutoff;
}

function scheduleExpiredHistoryPurge(userId, now = new Date()) {
  if ((nextHistoryPurgeByUser.get(userId) || 0) > now.getTime()) return;
  nextHistoryPurgeByUser.set(userId, now.getTime() + MATCH_HISTORY_PURGE_INTERVAL_MS);
  purgeExpiredHistory(userId, now).catch((err) => {
    nextHistoryPurgeByUser.delete(userId);
    console.warn(JSON.stringify({ event: "matching_history_purge_failed", error: err.message }));
  });
}

function inferTitle(text) {
  const firstLine = String(text).split(/\r?\n/).find((line) => line.trim().length > 4);
  return firstLine ? firstLine.trim().slice(0, 120) : "Vaga analisada";
}

function scoreRatio(matched, total) {
  return total ? Math.round((matched / total) * 100) : 0;
}

function validStructuredProject(project) {
  const title = String(project.title || "").trim();
  return title.length >= 2 &&
    !/^(modelagem|otimizacao|otimização|implementacao|implementação|construcao|construção|desenvolvimento|integracao|integração)\b/i.test(title) &&
    Boolean(String(project.shortDescription || "").trim());
}

function getMissingResumeFields(profile) {
  const missing = [];
  if (!String(profile.name || "").trim() || !String(profile.emailContact || profile.phone || "").trim()) {
    missing.push("dados pessoais (nome e e-mail ou telefone)");
  }
  if (!String(profile.summary || "").trim()) missing.push("resumo profissional");
  if (!(profile.skillItems || []).length) missing.push("habilidades");
  if (!(profile.educations || []).length && !(profile.experiences || []).length) {
    missing.push("pelo menos 1 formacao ou experiencia");
  }
  if (!(profile.projects || []).some(validStructuredProject)) missing.push("pelo menos 1 projeto estruturado");
  if ((profile.languages || []).some((language) => !String(language.name || "").trim() || !String(language.level || "").trim())) {
    missing.push("nivel dos idiomas cadastrados");
  }
  return missing;
}

function assertProfileReadyForResume(profile) {
  const missing = getMissingResumeFields(profile);
  if (!missing.length) return;
  const err = new Error(`Complete o perfil antes de gerar o curriculo otimizado. Campos faltantes: ${missing.join("; ")}.`);
  err.statusCode = 422;
  throw err;
}

function analyzeProfile(profile, jobDescription) {
  const job = classifyJob(jobDescription);
  const required = job.keywords;
  const skillMap = new Map((profile.skillItems || []).map((skill) => [normalizeTerm(skill.name), skill]));
  const matchedSkills = required.filter((keyword) => skillMap.has(normalizeTerm(keyword)))
    .map((keyword) => skillMap.get(normalizeTerm(keyword)).name);
  const missingSkills = required.filter((keyword) => !skillMap.has(normalizeTerm(keyword)));
  const validProjects = (profile.projects || []).filter(validStructuredProject);
  const selectedProjects = rankProjects(validProjects, required, 2);

  const skillsScore = scoreRatio(matchedSkills.length, required.length);
  const projectsScore = selectedProjects.length ? Math.round(selectedProjects.reduce((sum, item) => sum + item.score, 0) / selectedProjects.length) : 0;
  const totalScore = Math.round(skillsScore * 0.60 + projectsScore * 0.40);
  const warnings = [];
  if (!required.length) warnings.push("Nenhuma keyword tecnica reconhecida na vaga; revise a descricao informada.");
  if (missingSkills.length) warnings.push("Skills ausentes sao requisitos identificados na vaga e nao serao exibidas como habilidades do candidato.");
  if (!validProjects.length) warnings.push("Nao ha projetos estruturados suficientes para gerar um curriculo otimizado com qualidade.");
  if (validProjects.length !== (profile.projects || []).length) warnings.push("Projetos sem estrutura valida foram ignorados; revise os dados cadastrados no perfil.");

  return {
    jobCategory: job.category,
    jobKeywords: required,
    score: totalScore,
    scoreDetails: {
      skillsMatchScore: skillsScore,
      projectsMatchScore: projectsScore,
      totalScore,
    },
    matchedSkills: unique(matchedSkills),
    missingSkills,
    matchedTechnologies: unique(matchedSkills),
    missingTechnologies: missingSkills,
    selectedProjects,
    projectScores: selectedProjects.map((project) => ({ project, score: project.score, reason: project.reason })),
    warnings,
  };
}

async function selectProfile(userId, jobDescription, requestedProfileId) {
  if (requestedProfileId) return profileService.getProfile(userId, requestedProfileId);
  const listed = await profileService.listProfiles(userId);
  const candidates = await Promise.all(listed.map((item) => profileService.getProfile(userId, item.id)));
  return candidates.map((profile) => ({ profile, score: analyzeProfile(profile, jobDescription).score }))
    .sort((a, b) => b.score - a.score)[0]?.profile || profileService.getProfile(userId);
}

async function executeMatch(userId, jobDescription, profileId = null, metadata = {}) {
  const text = jobDescription.trim();
  const profile = await selectProfile(userId, text, profileId);
  assertProfileReadyForResume(profile);

  const analysis = analyzeProfile(profile, text);
  const targetTitle = metadata.jobTitle || inferTitle(text);
  const result = {
    ...analysis,
    targetTitle,
    selectedSubprofileId: profile.id,
    selectedSubprofileName: profile.profileName,
    linkVaga: metadata.linkVaga || "",
    suggestedSummary: profile.summary,
    semanticFeedback: `Matching deterministico: skills 60% e projetos 40%. Resumo, formacao, experiencias, cursos, certificacoes e idiomas permanecem conforme cadastrados. Categoria: ${analysis.jobCategory}.`,
  };
  const compiledResume = compileResume({ profile, matchResult: result });
  const generatedPdf = await generateOptimizedResumePdf({ profile, matchResult: result, compiledResume });
  const { saved, jobAnalysis } = await prisma.$transaction(async (tx) => {
    const savedResume = await tx.optimizedResume.create({
      data: {
        userId,
        targetTitle,
        jobDescription: text,
        score: result.score,
        suggestedSummary: profile.summary || "",
        selectedProjects: result.selectedProjects,
        matchedSkills: result.matchedSkills,
        missingSkills: result.missingSkills,
        matchedTechnologies: result.matchedTechnologies,
        missingTechnologies: result.missingTechnologies,
        profileId: profile.id,
        generatedPdf,
        generatedFileName: `curriculo-otimizado-${Date.now()}.pdf`,
      },
    });
    const analysisRow = await tx.jobAnalysis.create({
      data: {
        userId,
        jobTitle: targetTitle,
        company: metadata.company,
        jobUrl: metadata.linkVaga,
        jobDescription: text,
        selectedSubprofileId: profile.id,
        matchScore: result.score,
        jobCategory: result.jobCategory,
        matchedSkills: result.matchedSkills,
        missingSkills: result.missingSkills,
        selectedProjectIds: result.selectedProjects.map((project) => project.id),
        generatedResumeId: savedResume.id,
        status: "draft",
      },
    });
    await createSharedMatchedJob(tx, { jobTitle: targetTitle, company: metadata.company, linkVaga: metadata.linkVaga });
    return { saved: savedResume, jobAnalysis: analysisRow };
  });
  await Promise.all([
    cache.invalidate("match-history", userId),
    cache.invalidate("shared-matched-jobs", "global"),
  ]);

  return {
    ...result,
    id: saved.id,
    analysisId: jobAnalysis.id,
    status: jobAnalysis.status,
    resume: compiledResume,
    generatedPdfAvailable: true,
    generatedFileName: saved.generatedFileName,
    message: `Curriculo gerado com ${result.score}% de aderencia. Status: ainda nao aplicado. Revise antes de enviar.`,
  };
}

async function listHistory(userId, profileId = null) {
  const cutoff = historyRetentionCutoff();
  scheduleExpiredHistoryPurge(userId);
  const profile = await profileService.resolveProfile(userId, profileId);
  const history = await cache.remember("match-history", userId, profile.id, async () => {
    const rows = await prisma.jobAnalysis.findMany({
      where: { userId, selectedSubprofileId: profile.id, createdAt: { gte: cutoff } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        generatedResume: { select: { id: true, generatedFileName: true, resumeFileId: true } },
        applications: {
          where: { userId },
          orderBy: { data: "desc" },
          take: 1,
          select: { id: true, status: true, fase: true, data: true, linkCV: true },
        },
      },
    });
    return rows.map((row) => ({
      id: row.generatedResume?.id || row.id,
      analysisId: row.id,
      targetTitle: row.jobTitle,
      company: row.company,
      linkVaga: row.jobUrl,
      score: row.matchScore,
      status: row.status,
      jobCategory: row.jobCategory,
      generatedFileName: row.generatedResume?.generatedFileName,
      resumeFileId: row.generatedResume?.resumeFileId,
      application: row.applications[0] || null,
      appliedAt: row.appliedAt,
      createdAt: row.createdAt,
    }));
  }, 2 * 60);
  return history.filter((row) => new Date(row.createdAt) >= cutoff);
}

async function updateAnalysis(userId, id, data) {
  const existing = await prisma.jobAnalysis.findFirst({
    where: { id, userId, createdAt: { gte: historyRetentionCutoff() } },
  });
  if (!existing) {
    const err = new Error("Analise nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  const appliedAt = data.status === "applied" ? (existing.appliedAt || new Date()) : existing.appliedAt;
  const createsVersion = ["notes", "jobTitle", "company", "linkVaga", "jobDescription"].some((key) => data[key] !== undefined);
  let updated;
  if (createsVersion) {
    updated = await prisma.jobAnalysis.create({
      data: {
        userId,
        jobTitle: data.jobTitle ?? existing.jobTitle,
        company: data.company ?? existing.company,
        jobUrl: data.linkVaga ?? existing.jobUrl,
        jobDescription: data.jobDescription ?? existing.jobDescription,
        selectedSubprofileId: existing.selectedSubprofileId,
        matchScore: existing.matchScore,
        jobCategory: existing.jobCategory,
        matchedSkills: existing.matchedSkills,
        missingSkills: existing.missingSkills,
        selectedProjectIds: existing.selectedProjectIds,
        generatedResumeId: existing.generatedResumeId,
        status: data.status ?? "draft",
        notes: data.notes ?? existing.notes,
        appliedAt,
        parentAnalysisId: existing.id,
        version: existing.version + 1,
      },
    });
  } else {
    const { linkVaga, ...updates } = data;
    updated = await prisma.jobAnalysis.update({
      where: { id },
      data: { ...updates, ...(linkVaga !== undefined ? { jobUrl: linkVaga } : {}), appliedAt },
    });
  }
  await cache.invalidate("match-history", userId);
  return updated;
}

async function getAnalysis(userId, id) {
  const row = await prisma.jobAnalysis.findFirst({
    where: { id, userId, createdAt: { gte: historyRetentionCutoff() } },
    include: {
      selectedSubprofile: { select: { id: true, profileName: true } },
      generatedResume: { select: { id: true, generatedFileName: true } },
      applications: {
        where: { userId },
        orderBy: { data: "desc" },
        select: { id: true, status: true, fase: true, linkVaga: true, linkCV: true, data: true },
      },
    },
  });
  if (!row) {
    const err = new Error("Analise nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  return row;
}

async function getGeneratedPdf(userId, id) {
  const row = await prisma.optimizedResume.findFirst({
    where: { id, userId, createdAt: { gte: historyRetentionCutoff() } },
    select: { generatedPdf: true, generatedFileName: true },
  });
  if (!row || !row.generatedPdf) {
    const err = new Error("PDF otimizado nao encontrado para esta analise");
    err.statusCode = 404;
    throw err;
  }
  return { fileName: row.generatedFileName || "curriculo-otimizado.pdf", content: Buffer.from(row.generatedPdf) };
}

async function deleteHistory(userId, id) {
  await prisma.jobAnalysis.deleteMany({ where: { generatedResumeId: id, userId } });
  const result = await prisma.optimizedResume.deleteMany({ where: { id, userId } });
  if (!result.count) {
    const err = new Error("Versao otimizada nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  await cache.invalidate("match-history", userId);
  return { message: "Removido" };
}

module.exports = {
  executeMatch,
  listHistory,
  deleteHistory,
  getGeneratedPdf,
  getAnalysis,
  updateAnalysis,
  analyzeProfile,
  getMissingResumeFields,
  assertProfileReadyForResume,
  MATCH_HISTORY_RETENTION_DAYS,
  historyRetentionCutoff,
  purgeExpiredHistory,
  scheduleExpiredHistoryPurge,
};
