const { prisma } = require("../lib/prisma");
const cache = require("../lib/cache");
const profileService = require("./profile.service");
const { generateOptimizedResumePdf } = require("./pdf-output.service");
const {
  evaluateJobMatch,
  inferSeniority: inferJobSeniority,
  normalizeSeniorityLevel,
  validStructuredProject,
} = require("../modules/matching/job-match-evaluator.service");
const { compileResume, collectLearnedSkillItems } = require("../modules/resume/resume-compiler.service");
const { createSharedMatchedJob } = require("../modules/matching/shared-matched-jobs.service");
const { recordApplicationStatusHistory } = require("../modules/application-tracking/application-history.service");
const subscriptionService = require("./subscription.service");

function inferTitle(text) {
  const firstLine = String(text).split(/\r?\n/).find((line) => line.trim().length > 4);
  return firstLine ? firstLine.trim().slice(0, 120) : "Vaga analisada";
}

function normalizeSeniority(value) {
  return normalizeSeniorityLevel(value);
}

function inferSeniority(text) {
  return inferJobSeniority(text);
}

function seniorityMatchScore(profileSeniority, jobSeniority) {
  return evaluateJobMatch({
    profile: { seniority: profileSeniority, skillItems: [], projects: [], courses: [], certifications: [] },
    jobTitle: String(jobSeniority || ""),
  }).seniorityMatch.score;
}
function getMissingResumeFields(profile) {
  const missing = [];
  if (!String(profile.name || "").trim() || !String(profile.emailContact || profile.phone || "").trim()) {
    missing.push("dados pessoais (nome e e-mail ou telefone)");
  }
  if (!String(profile.objective || "").trim()) missing.push("objetivo profissional");
  if (!String(profile.summary || "").trim()) missing.push("resumo profissional");
  if (!String(profile.seniority || "").trim()) missing.push("senioridade");
  if (!(profile.skillItems || []).length && !collectLearnedSkillItems(profile).length) missing.push("habilidades");
  if (!(profile.educations || []).length) missing.push("pelo menos 1 formacao");
  if (!(profile.languages || []).length) missing.push("pelo menos 1 idioma");
  if (!(profile.projects || []).some(validStructuredProject)) missing.push("pelo menos 1 projeto estruturado");
  if (!(profile.courses || []).length && !(profile.certifications || []).length) missing.push("pelo menos 1 curso ou certificacao");
  if (!hasRequiredLearnedSkills(profile)) missing.push("habilidades aprendidas em formacao, projetos, cursos e certificacoes");
  if ((profile.languages || []).some((language) => !String(language.name || "").trim() || !String(language.level || "").trim())) {
    missing.push("nivel dos idiomas cadastrados");
  }
  return missing;
}

function hasRequiredLearnedSkills(profile) {
  const collections = [
    ...(profile.educations || []),
    ...(profile.projects || []),
    ...(profile.courses || []),
    ...(profile.certifications || []),
  ];
  return collections.length > 0 && collections.every((item) => (item.learnedSkills || []).length > 0);
}

function assertProfileReadyForResume(profile) {
  const missing = getMissingResumeFields(profile);
  if (!missing.length) return;
  const learnedSkillsMissing = missing.some((item) => item.includes("habilidades aprendidas"));
  const err = new Error(learnedSkillsMissing
    ? "Preencha as habilidades aprendidas antes de gerar o matching."
    : `Complete o perfil antes de gerar o curriculo otimizado. Campos faltantes: ${missing.join("; ")}.`);
  err.statusCode = 422;
  err.code = learnedSkillsMissing ? "LEARNED_SKILLS_REQUIRED" : "PROFILE_INCOMPLETE";
  err.details = { missing };
  throw err;
}

function requireConfirmedSeniority(metadata = {}) {
  if (metadata.confirmedSeniority) return normalizeSeniority(metadata.confirmedSeniority);
  const text = [metadata.jobTitle, metadata.company, metadata.jobDescription].filter(Boolean).join(" ");
  const err = new Error("Confirme ou ajuste a senioridade da vaga antes de gerar o matching.");
  err.statusCode = 409;
  err.code = "SENIORITY_CONFIRMATION_REQUIRED";
  err.details = { inferredSeniority: inferSeniority(text) };
  throw err;
}

function analysisStatusToJobUpdate(status) {
  if (status === "draft" || status === "Currículo gerado") return { fase: "Currículo gerado", status: "Ativa" };
  if (status === "applied" || status === "Aplicada") return { fase: "Aplicada", status: "Ativa" };
  if (status === "reviewed") return { fase: "Feedback", status: "Ativa" };
  if (status === "Entrevista" || status === "Teste técnico" || status === "Feedback") return { fase: status, status: "Ativa" };
  if (status === "archived" || status === "rejected" || status === "Encerrada") return { fase: "Encerrada", status: "Encerrada" };
  return null;
}

function isAppliedAnalysisStatus(status) {
  return status === "applied" || status === "Aplicada";
}

function analyzeProfile(profile, jobDescription, metadata = {}) {
  return evaluateJobMatch({
    profile,
    jobTitle: metadata.jobTitle || "",
    company: metadata.company || "",
    jobDescription,
    confirmedSeniority: metadata.confirmedSeniority,
  });
}
async function selectProfile(userId, jobDescription, requestedProfileId, metadata = {}) {
  if (requestedProfileId) return profileService.getProfile(userId, requestedProfileId);
  const listed = await profileService.listProfiles(userId);
  const candidates = await Promise.all(listed.map((item) => profileService.getProfile(userId, item.id)));
  return candidates.map((profile) => ({ profile, score: analyzeProfile(profile, jobDescription, metadata).score }))
    .sort((a, b) => b.score - a.score)[0]?.profile || profileService.getProfile(userId);
}

async function executeMatch(userId, jobDescription, profileId = null, metadata = {}) {
  const text = jobDescription.trim();
  const confirmedSeniority = requireConfirmedSeniority({ ...metadata, jobDescription: text });
  const normalizedMetadata = { ...metadata, confirmedSeniority };
  const profile = await selectProfile(userId, text, profileId, normalizedMetadata);
  assertProfileReadyForResume(profile);

  const analysis = analyzeProfile(profile, text, normalizedMetadata);
  const targetTitle = metadata.jobTitle || inferTitle(text);
  const result = {
    ...analysis,
    targetTitle,
    selectedSubprofileId: profile.id,
    selectedSubprofileName: profile.profileName,
    linkVaga: metadata.linkVaga || "",
    suggestedSummary: profile.summary,
    semanticFeedback: `Matching deterministico: score base por habilidades 70% e projetos 30%, com senioridade aplicada como teto ou penalidade. Resumo, formacao, experiencias e idiomas permanecem conforme cadastrados. Categoria: ${analysis.jobCategory}.`,
  };
  const compiledResume = compileResume({ profile, matchResult: result });
  const generatedPdf = await generateOptimizedResumePdf({ profile, matchResult: result, compiledResume });
  const { saved, jobAnalysis } = await prisma.$transaction(async (tx) => {
    await subscriptionService.consumeMatchingQuota(userId, tx);
    const savedResume = await tx.optimizedResume.create({
      data: {
        userId,
        targetTitle,
        jobDescription: text,
        score: result.overallScore,
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
        matchScore: result.overallScore,
        jobCategory: result.jobCategory,
        matchedSkills: result.matchedSkills,
        missingSkills: result.missingSkills,
        selectedProjectIds: result.selectedProjects.map((project) => project.id),
        selectedCourseIds: result.selectedCourses.map((course) => course.id).filter(Boolean),
        selectedCertificationIds: result.selectedCertifications.map((certification) => certification.id).filter(Boolean),
        extraRelevantSkills: result.extraRelevantSkills,
        confirmedSeniority: result.confirmedSeniority,
        inferredSeniority: result.inferredSeniority,
        aderenciaBase: result.aderenciaBase,
        aderenciaFinal: result.aderenciaFinal,
        skillsScore: result.scoreDetails.skillsMatchScore,
        projectsScore: result.scoreDetails.projectsMatchScore,
        seniorityPenalty: result.seniorityPenalty,
        warnings: result.warnings,
        scoringVersion: result.scoringVersion,
        generatedResumeId: savedResume.id,
        status: "Currículo gerado",
      },
    });
    await createSharedMatchedJob(tx, {
      jobTitle: targetTitle,
      company: metadata.company,
      linkVaga: metadata.linkVaga,
      jobDescription: text,
      confirmedSeniority: result.confirmedSeniority,
      inferredSeniority: result.inferredSeniority,
    });
    return { saved: savedResume, jobAnalysis: analysisRow };
  });
  await Promise.all([
    cache.invalidate("match-history", userId),
    cache.invalidate("shared-jobs-board", "global"),
  ]);

  return {
    ...result,
    id: saved.id,
    analysisId: jobAnalysis.id,
    status: jobAnalysis.status,
    resume: compiledResume,
    generatedPdfAvailable: true,
    generatedFileName: saved.generatedFileName,
    message: `Curriculo gerado com ${result.overallScore}% de aderencia. Status: ainda nao aplicado. Revise antes de enviar.`,
  };
}

async function listHistory(userId, profileId = null) {
  const history = await cache.remember("match-history", userId, profileId || "default", async () => {
    const selectedSubprofileId = profileId || (await profileService.resolveProfile(userId)).id;
    const rows = await prisma.jobAnalysis.findMany({
      where: { userId, selectedSubprofileId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        jobTitle: true,
        company: true,
        jobUrl: true,
        matchScore: true,
        status: true,
        jobCategory: true,
        appliedAt: true,
        createdAt: true,
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
  return history;
}

async function updateAnalysis(userId, id, data) {
  const existing = await prisma.jobAnalysis.findFirst({
    where: { id, userId },
  });
  if (!existing) {
    const err = new Error("Analise nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  const appliedAt = isAppliedAnalysisStatus(data.status) ? (existing.appliedAt || new Date()) : existing.appliedAt;
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
        status: data.status ?? existing.status ?? "Currículo gerado",
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
  const linkedJobUpdate = analysisStatusToJobUpdate(data.status);
  if (linkedJobUpdate) {
    if (typeof prisma.$transaction !== "function") {
      await prisma.job.updateMany({
        where: { userId, jobAnalysisId: id },
        data: linkedJobUpdate,
      });
    } else {
      await prisma.$transaction(async (tx) => {
      const linkedJobs = await tx.job.findMany({ where: { userId, jobAnalysisId: id } });
      await tx.job.updateMany({
        where: { userId, jobAnalysisId: id },
        data: linkedJobUpdate,
      });
      await Promise.all(linkedJobs.map((job) => recordApplicationStatusHistory(tx, {
        userId,
        jobId: job.id,
        statusAnterior: job.status,
        novoStatus: linkedJobUpdate.status,
        faseAnterior: job.fase,
        novaFase: linkedJobUpdate.fase,
        observacao: "Atualizacao sincronizada pelo historico de matching.",
      })));
      });
    }
  }
  await Promise.all([
    cache.invalidate("match-history", userId),
    ...(linkedJobUpdate ? [cache.invalidate("jobs", userId)] : []),
  ]);
  return updated;
}

async function getAnalysis(userId, id) {
  const row = await prisma.jobAnalysis.findFirst({
    where: { id, userId },
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
    where: { id, userId },
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
  inferSeniority,
  normalizeSeniority,
  seniorityMatchScore,
  analysisStatusToJobUpdate,
};

