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
const { matchingSnapshotFromAnalysis } = require("../modules/application-tracking/application-tracking.service");
const subscriptionService = require("./subscription.service");

function inferTitle(text) {
  const firstLine = String(text).split(/\r?\n/).find((line) => line.trim().length > 4);
  return firstLine ? firstLine.trim().slice(0, 120) : "Vaga analisada";
}

function inferSeniority(text) {
  return inferJobSeniority(text);
}

function buildRecommendation(result) {
  const score = Number(result.overallScore || 0);
  const matched = (result.matchedSkills || []).length;
  const total = matched + (result.missingSkills || []).length;
  const attends = `Voce atende ${matched} de ${total} requisito${total !== 1 ? "s" : ""} analisado${total !== 1 ? "s" : ""}.`;

  if (score >= 80) return [
    "Recomendacao: Vale a candidatura.",
    attends,
    "Seu perfil apresenta forte aderencia a vaga. Suas habilidades, projetos e formacoes demonstram compatibilidade com a maior parte dos requisitos solicitados.",
  ].join("\n\n");

  if (score >= 60) return [
    "Recomendacao: Vale a candidatura.",
    attends,
    "Seu perfil possui boa compatibilidade com a vaga. Suas habilidades e projetos estao alinhados a requisitos importantes, e as lacunas identificadas podem ser tratadas como pontos de desenvolvimento.",
  ].join("\n\n");

  if (score >= 40) return [
    "Recomendacao: Candidatura possivel.",
    attends,
    "Seu perfil possui aderencia parcial com a vaga. Existem pontos compativeis, mas tambem ha requisitos relevantes que ainda nao aparecem no seu perfil cadastrado.\n\nCaso a vaga esteja alinhada ao seu objetivo profissional, a candidatura pode ser valida, especialmente se o curriculo destacar melhor seus projetos, cursos e habilidades relacionadas.",
  ].join("\n\n");

  if (score >= 20) return [
    "Recomendacao: Candidatura opcional.",
    attends,
    "Foram identificados alguns pontos de compatibilidade, porem a vaga exige requisitos que ainda nao estao bem representados no seu perfil.\n\nAntes de investir tempo nessa candidatura, avalie se ela esta alinhada ao seu momento profissional. Esta vaga tambem pode servir como referencia para direcionar seus proximos estudos e projetos.",
  ].join("\n\n");

  return [
    "Recomendacao: Priorize outras oportunidades neste momento.",
    attends,
    "A vaga exige conhecimentos e experiencias que ainda nao aparecem de forma significativa no seu perfil cadastrado.\n\nPode ser mais estrategico buscar vagas mais alinhadas ao seu momento atual e usar esta analise para identificar quais habilidades, cursos ou projetos desenvolver.",
  ].join("\n\n");
}

function getMissingResumeFields(profile) {
  const missing = [];
  if (!String(profile.name || "").trim() || !String(profile.emailContact || profile.phone || "").trim()) {
    missing.push("dados pessoais (nome e e-mail ou telefone)");
  }
  if (!String(profile.objective || "").trim()) missing.push("objetivo profissional");
  if (!String(profile.summary || "").trim()) missing.push("resumo profissional");
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

function profileAudit(profile) {
  return {
    selectedProfileType: profile?.isGlobal ? "global" : "subprofile",
    selectedProfileName: profile?.profileName || (profile?.isGlobal ? "Perfil Global" : "Subperfil"),
    selectedSubprofileId: profile?.id || null,
  };
}

function snapshotProjects(projects = []) {
  return projects.map((project) => ({
    id: project.id,
    title: project.title,
    score: project.score,
    matchedKeywords: project.matchedKeywords || [],
    repositoryUrl: project.repositoryUrl || "",
    deployUrl: project.deployUrl || "",
  }));
}

function snapshotLearning(items = []) {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    issuer: item.issuer || item.institution || "",
    itemType: item.itemType,
    matchedKeywords: item.matchedKeywords || [],
    workload: item.workload || "",
    period: item.period || "",
  }));
}

async function compareWithGlobalProfile(userId, selectedProfile, jobDescription, metadata, selectedResult) {
  const globalProfile = selectedProfile?.isGlobal ? selectedProfile : await profileService.getProfile(userId);
  const globalMissing = getMissingResumeFields(globalProfile);
  if (globalMissing.length) {
    return {
      globalScore: 0,
      globalAnalysisStatus: "incomplete",
      globalWarnings: globalMissing.map((field) => `Perfil Global incompleto: ${field}`),
    };
  }
  const globalResult = globalProfile.id === selectedProfile.id
    ? selectedResult
    : analyzeProfile(globalProfile, jobDescription, metadata);
  return {
    globalScore: globalResult.overallScore,
    globalAnalysisStatus: "complete",
    globalWarnings: [],
  };
}

function buildAnalysisData({
  userId,
  profile,
  result,
  targetTitle,
  metadata,
  jobDescription,
  generatedResumeId = null,
  globalScore = 0,
  globalAnalysisStatus = "complete",
  warnings = [],
  analysisStatus = "complete",
  recalculationReason = "initial",
  sourceAnalysisId = null,
  parentAnalysisId = null,
  version = 1,
  jobOrigin = "individual",
}) {
  const audit = profileAudit(profile);
  return {
    userId,
    jobTitle: targetTitle,
    company: metadata.company || "",
    jobUrl: metadata.linkVaga || metadata.jobUrl || "",
    jobDescription,
    jobOrigin,
    selectedProfileType: audit.selectedProfileType,
    selectedProfileName: audit.selectedProfileName,
    selectedSubprofileId: audit.selectedSubprofileId,
    matchScore: result.overallScore,
    globalScore,
    globalAnalysisStatus,
    selectedProfileScore: result.overallScore,
    jobCategory: result.jobCategory,
    matchedSkills: result.matchedSkills,
    missingSkills: result.missingSkills,
    selectedProjectIds: result.selectedProjects.map((project) => project.id).filter(Boolean),
    selectedCourseIds: result.selectedCourses.map((course) => course.id).filter(Boolean),
    selectedCertificationIds: result.selectedCertifications.map((certification) => certification.id).filter(Boolean),
    selectedProjectsSnapshot: snapshotProjects(result.selectedProjects),
    selectedCoursesSnapshot: snapshotLearning(result.selectedCourses),
    selectedCertificationsSnapshot: snapshotLearning(result.selectedCertifications),
    extraRelevantSkills: result.extraRelevantSkills,
    confirmedSeniority: result.confirmedSeniority,
    inferredSeniority: result.inferredSeniority,
    aderenciaBase: result.aderenciaBase,
    aderenciaFinal: result.aderenciaFinal,
    skillsScore: result.scoreDetails.skillsMatchScore,
    projectsScore: result.scoreDetails.projectsMatchScore,
    seniorityPenalty: result.seniorityPenalty,
    warnings: [...new Set([...(result.warnings || []), ...(warnings || [])])],
    scoringVersion: result.scoringVersion,
    analysisStatus,
    recalculationReason,
    sourceAnalysisId,
    parentAnalysisId,
    version,
    generatedResumeId,
    status: "Currículo gerado",
  };
}

function buildResultPayload({ result, profile, targetTitle, metadata, savedResume, jobAnalysis, globalScore, globalAnalysisStatus = "complete", analysisStatus }) {
  return {
    ...result,
    targetTitle,
    selectedSubprofileId: profile.id,
    selectedSubprofileName: profile.profileName,
    selectedProfileType: profile.isGlobal ? "global" : "subprofile",
    selectedProfileName: profile.profileName,
    selectedProfileScore: result.overallScore,
    globalScore,
    globalAnalysisStatus,
    analysisStatus,
    linkVaga: metadata.linkVaga || metadata.jobUrl || "",
    suggestedSummary: profile.summary,
    semanticFeedback: analysisStatus === "complete" ? buildRecommendation(result) : "Analise incompleta. Complete o perfil para obter uma recomendacao precisa.",
    id: savedResume?.id || jobAnalysis.id,
    analysisId: jobAnalysis.id,
    status: jobAnalysis.status,
    generatedPdfAvailable: Boolean(savedResume?.generatedPdf || savedResume?.generatedFileName),
    generatedFileName: savedResume?.generatedFileName,
    message: analysisStatus === "complete"
      ? "Curriculo otimizado gerado. Revise antes de enviar."
      : "Analise salva como incompleta. Complete o perfil antes de confiar no percentual.",
  };
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
  const normalizedMetadata = { ...metadata };
  const profile = await selectProfile(userId, text, profileId, normalizedMetadata);
  assertProfileReadyForResume(profile);

  const analysis = analyzeProfile(profile, text, normalizedMetadata);
  const targetTitle = metadata.jobTitle || inferTitle(text);
  const comparison = await compareWithGlobalProfile(userId, profile, text, normalizedMetadata, analysis);
  const result = buildResultPayload({
    result: analysis,
    profile,
    targetTitle,
    metadata,
    savedResume: null,
    jobAnalysis: { id: "", status: "Currículo gerado" },
    globalScore: comparison.globalScore,
    globalAnalysisStatus: comparison.globalAnalysisStatus,
    analysisStatus: "complete",
  });
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
        ...buildAnalysisData({
          userId,
          profile,
          result,
          targetTitle,
          metadata,
          jobDescription: text,
          generatedResumeId: savedResume.id,
          globalScore: comparison.globalScore,
          globalAnalysisStatus: comparison.globalAnalysisStatus,
          warnings: comparison.globalWarnings,
        }),
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
    ...buildResultPayload({
      result,
      profile,
      targetTitle,
      metadata,
      savedResume: saved,
      jobAnalysis,
      globalScore: comparison.globalScore,
      globalAnalysisStatus: comparison.globalAnalysisStatus,
      analysisStatus: "complete",
    }),
    resume: compiledResume,
  };
}

async function listHistory(userId, profileId = null, { cursor = null, limit = 20 } = {}) {
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
        jobOrigin: true,
        selectedProfileType: true,
        selectedProfileName: true,
        selectedSubprofileId: true,
        matchScore: true,
        globalScore: true,
        globalAnalysisStatus: true,
        selectedProfileScore: true,
        skillsScore: true,
        projectsScore: true,
        matchedSkills: true,
        missingSkills: true,
        extraRelevantSkills: true,
        selectedProjectIds: true,
        selectedCourseIds: true,
        selectedCertificationIds: true,
        selectedProjectsSnapshot: true,
        selectedCoursesSnapshot: true,
        selectedCertificationsSnapshot: true,
        confirmedSeniority: true,
        inferredSeniority: true,
        analysisStatus: true,
        warnings: true,
        scoringVersion: true,
        recalculationReason: true,
        sourceAnalysisId: true,
        parentAnalysisId: true,
        version: true,
        status: true,
        jobCategory: true,
        appliedAt: true,
        createdAt: true,
        selectedSubprofile: { select: { id: true, profileName: true, isGlobal: true } },
        generatedResume: { select: { id: true, generatedFileName: true, resumeFileId: true } },
        applications: {
          where: { userId },
          orderBy: { data: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            fase: true,
            data: true,
            linkVaga: true,
            linkCV: true,
            optimizedResumeId: true,
            matchingSnapshot: true,
          },
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
      overallScore: row.matchScore,
      globalScore: row.globalScore,
      globalAnalysisStatus: row.globalAnalysisStatus,
      selectedProfileScore: row.selectedProfileScore,
      selectedProfileType: row.selectedProfileType,
      selectedProfileName: row.selectedProfileName || row.selectedSubprofile?.profileName || "",
      selectedSubprofileId: row.selectedSubprofileId,
      selectedSubprofileName: row.selectedSubprofile?.profileName || row.selectedProfileName || "",
      skillsScore: row.skillsScore,
      projectsScore: row.projectsScore,
      matchedSkills: row.matchedSkills || [],
      missingSkills: row.missingSkills || [],
      extraRelevantSkills: row.extraRelevantSkills || [],
      selectedProjectIds: row.selectedProjectIds || [],
      selectedCourseIds: row.selectedCourseIds || [],
      selectedCertificationIds: row.selectedCertificationIds || [],
      selectedProjects: row.selectedProjectsSnapshot || [],
      selectedCourses: row.selectedCoursesSnapshot || [],
      selectedCertifications: row.selectedCertificationsSnapshot || [],
      confirmedSeniority: row.confirmedSeniority,
      inferredSeniority: row.inferredSeniority,
      analysisStatus: row.analysisStatus || "complete",
      warnings: row.warnings || [],
      scoringVersion: row.scoringVersion,
      recalculationReason: row.recalculationReason,
      sourceAnalysisId: row.sourceAnalysisId || row.parentAnalysisId,
      version: row.version,
      jobOrigin: row.jobOrigin,
      status: row.status,
      jobCategory: row.jobCategory,
      generatedFileName: row.generatedResume?.generatedFileName,
      resumeFileId: row.generatedResume?.resumeFileId,
      application: row.applications[0] || null,
      appliedAt: row.appliedAt,
      createdAt: row.createdAt,
    }));
  }, 2 * 60);

  let items = history;
  if (cursor) {
    const idx = items.findIndex((item) => item.analysisId === cursor);
    items = idx >= 0 ? items.slice(idx + 1) : [];
  }
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const page = items.slice(0, safeLimit);
  const nextCursor = (page.length === safeLimit && items.length > safeLimit)
    ? page[page.length - 1].analysisId
    : null;
  return { items: page, nextCursor };
}

async function updateAnalysisLegacy(userId, id, data) {
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
        jobOrigin: existing.jobOrigin,
        selectedProfileType: existing.selectedProfileType,
        selectedProfileName: existing.selectedProfileName,
        selectedSubprofileId: existing.selectedSubprofileId,
        matchScore: existing.matchScore,
        globalScore: existing.globalScore,
        globalAnalysisStatus: existing.globalAnalysisStatus,
        selectedProfileScore: existing.selectedProfileScore,
        jobCategory: existing.jobCategory,
        matchedSkills: existing.matchedSkills,
        missingSkills: existing.missingSkills,
        extraRelevantSkills: existing.extraRelevantSkills,
        selectedProjectIds: existing.selectedProjectIds,
        selectedCourseIds: existing.selectedCourseIds,
        selectedCertificationIds: existing.selectedCertificationIds,
        selectedProjectsSnapshot: existing.selectedProjectsSnapshot,
        selectedCoursesSnapshot: existing.selectedCoursesSnapshot,
        selectedCertificationsSnapshot: existing.selectedCertificationsSnapshot,
        confirmedSeniority: existing.confirmedSeniority,
        inferredSeniority: existing.inferredSeniority,
        aderenciaBase: existing.aderenciaBase,
        aderenciaFinal: existing.aderenciaFinal,
        skillsScore: existing.skillsScore,
        projectsScore: existing.projectsScore,
        seniorityPenalty: existing.seniorityPenalty,
        warnings: existing.warnings,
        scoringVersion: existing.scoringVersion,
        analysisStatus: existing.analysisStatus,
        recalculationReason: existing.recalculationReason,
        sourceAnalysisId: existing.sourceAnalysisId,
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

async function updateAnalysis(userId, id, data) {
  const existing = await prisma.jobAnalysis.findFirst({ where: { id, userId } });
  if (!existing) {
    const err = new Error("Analise nao encontrada");
    err.statusCode = 404;
    throw err;
  }

  const appliedAt = isAppliedAnalysisStatus(data.status) ? (existing.appliedAt || new Date()) : existing.appliedAt;
  const createsVersion = ["notes", "jobTitle", "company", "linkVaga", "jobDescription"].some((key) => data[key] !== undefined);

  if (!createsVersion) {
    const { linkVaga, ...updates } = data;
    const updated = await prisma.jobAnalysis.update({
      where: { id },
      data: { ...updates, ...(linkVaga !== undefined ? { jobUrl: linkVaga } : {}), appliedAt },
    });
    const linkedJobUpdate = analysisStatusToJobUpdate(data.status);
    if (linkedJobUpdate) {
      const runInTransaction = typeof prisma.$transaction === "function"
        ? prisma.$transaction.bind(prisma)
        : async (work) => work(prisma);
      await runInTransaction(async (tx) => {
        const linkedJobs = tx.job?.findMany
          ? await tx.job.findMany({ where: { userId, jobAnalysisId: id } })
          : [];
        if (tx.job?.updateMany) {
          await tx.job.updateMany({
            where: { userId, jobAnalysisId: id },
            data: linkedJobUpdate,
          });
        }
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
    await Promise.all([
      cache.invalidate("match-history", userId),
      ...(linkedJobUpdate ? [cache.invalidate("jobs", userId)] : []),
    ]);
    return updated;
  }

  const targetTitle = data.jobTitle ?? existing.jobTitle;
  const jobDescription = data.jobDescription ?? existing.jobDescription;
  const metadata = {
    jobTitle: targetTitle,
    company: data.company ?? existing.company,
    linkVaga: data.linkVaga ?? existing.jobUrl,
    jobUrl: data.linkVaga ?? existing.jobUrl,
    confirmedSeniority: existing.confirmedSeniority && existing.confirmedSeniority !== "unknown"
      ? existing.confirmedSeniority
      : existing.inferredSeniority,
  };
  const profile = existing.selectedSubprofileId
    ? await profileService.getProfile(userId, existing.selectedSubprofileId)
    : await profileService.getProfile(userId);
  const result = analyzeProfile(profile, jobDescription, metadata);
  const comparison = await compareWithGlobalProfile(userId, profile, jobDescription, metadata, result);
  const resultPayload = buildResultPayload({
    result,
    profile,
    targetTitle,
    metadata,
    savedResume: null,
    jobAnalysis: { id: existing.id, status: data.status ?? existing.status },
    globalScore: comparison.globalScore,
    globalAnalysisStatus: comparison.globalAnalysisStatus,
    analysisStatus: "complete",
  });
  const compiledResume = compileResume({ profile, matchResult: resultPayload });
  const generatedPdf = await generateOptimizedResumePdf({ profile, matchResult: resultPayload, compiledResume });
  const linkedJobUpdate = analysisStatusToJobUpdate(data.status);
  const runInTransaction = typeof prisma.$transaction === "function"
    ? prisma.$transaction.bind(prisma)
    : async (work) => work(prisma);

  const updated = await runInTransaction(async (tx) => {
    const savedResume = await tx.optimizedResume.create({
      data: {
        userId,
        targetTitle,
        jobDescription,
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
    const analysisData = {
      ...buildAnalysisData({
        userId,
        profile,
        result,
        targetTitle,
        metadata,
        jobDescription,
        generatedResumeId: savedResume.id,
        globalScore: comparison.globalScore,
        globalAnalysisStatus: comparison.globalAnalysisStatus,
        warnings: comparison.globalWarnings,
        recalculationReason: "manual_edit",
        sourceAnalysisId: existing.sourceAnalysisId || existing.id,
        parentAnalysisId: existing.id,
        version: (existing.version || 1) + 1,
        jobOrigin: existing.jobOrigin || "individual",
      }),
      status: data.status ?? existing.status ?? "draft",
      notes: data.notes ?? existing.notes,
      appliedAt,
    };
    const analysisRow = await tx.jobAnalysis.create({ data: analysisData });
    const linkedJobs = tx.job?.findMany
      ? await tx.job.findMany({ where: { userId, jobAnalysisId: existing.id } })
      : [];
    if (tx.job?.updateMany) {
      await tx.job.updateMany({
        where: { userId, jobAnalysisId: existing.id },
        data: {
          jobAnalysisId: analysisRow.id,
          optimizedResumeId: savedResume.id,
          matchingSnapshot: matchingSnapshotFromAnalysis({ ...analysisData, id: analysisRow.id }),
          ...(linkedJobUpdate || {}),
        },
      });
    }
    if (linkedJobUpdate) {
      await Promise.all(linkedJobs.map((job) => recordApplicationStatusHistory(tx, {
        userId,
        jobId: job.id,
        statusAnterior: job.status,
        novoStatus: linkedJobUpdate.status,
        faseAnterior: job.fase,
        novaFase: linkedJobUpdate.fase,
        observacao: "Atualizacao sincronizada pela nova versao do historico de matching.",
      })));
    }
    return analysisRow;
  });

  await Promise.all([
    cache.invalidate("match-history", userId),
    cache.invalidate("jobs", userId),
  ]);
  return updated;
}

async function recalculateAnalysis(userId, id, data = {}) {
  const existing = await prisma.jobAnalysis.findFirst({ where: { id, userId } });
  if (!existing) {
    const err = new Error("Analise nao encontrada");
    err.statusCode = 404;
    throw err;
  }

  const profileId = data.subprofileId || data.profileId || null;
  const profile = profileId ? await profileService.getProfile(userId, profileId) : await profileService.getProfile(userId);
  const missing = getMissingResumeFields(profile);
  if (missing.length && !data.force) {
    const err = new Error("Este perfil nao possui dados suficientes para uma analise confiavel.");
    err.statusCode = 422;
    err.code = "PROFILE_INCOMPLETE";
    err.details = { missing, canForce: true };
    throw err;
  }

  const metadata = {
    jobTitle: existing.jobTitle,
    company: existing.company,
    linkVaga: existing.jobUrl,
    confirmedSeniority: existing.confirmedSeniority && existing.confirmedSeniority !== "unknown"
      ? existing.confirmedSeniority
      : existing.inferredSeniority,
  };
  const result = analyzeProfile(profile, existing.jobDescription, metadata);
  const comparison = await compareWithGlobalProfile(userId, profile, existing.jobDescription, metadata, result);
  const analysisStatus = missing.length ? "incomplete" : "complete";
  const profileWarnings = missing.map((field) => `Perfil usado incompleto: ${field}`);
  const targetTitle = existing.jobTitle || inferTitle(existing.jobDescription);
  const resultPayload = buildResultPayload({
    result,
    profile,
    targetTitle,
    metadata,
    savedResume: null,
    jobAnalysis: { id: "", status: "Currículo gerado" },
    globalScore: comparison.globalScore,
    globalAnalysisStatus: comparison.globalAnalysisStatus,
    analysisStatus,
  });

  let compiledResume = null;
  let generatedPdf = null;
  if (analysisStatus === "complete") {
    compiledResume = compileResume({ profile, matchResult: resultPayload });
    generatedPdf = await generateOptimizedResumePdf({ profile, matchResult: resultPayload, compiledResume });
  }

  const { savedResume, analysisRow } = await prisma.$transaction(async (tx) => {
    await subscriptionService.consumeMatchingQuota(userId, tx);
    const saved = analysisStatus === "complete"
      ? await tx.optimizedResume.create({
        data: {
          userId,
          targetTitle,
          jobDescription: existing.jobDescription,
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
      })
      : null;
    const row = await tx.jobAnalysis.create({
      data: buildAnalysisData({
        userId,
        profile,
        result,
        targetTitle,
        metadata,
        jobDescription: existing.jobDescription,
        generatedResumeId: saved?.id || null,
        globalScore: comparison.globalScore,
        globalAnalysisStatus: comparison.globalAnalysisStatus,
        warnings: [...comparison.globalWarnings, ...profileWarnings],
        analysisStatus,
        recalculationReason: "manual_subprofile_change",
        sourceAnalysisId: existing.id,
        parentAnalysisId: existing.id,
        version: (existing.version || 1) + 1,
        jobOrigin: existing.jobOrigin || "individual",
      }),
    });
    return { savedResume: saved, analysisRow: row };
  });

  await Promise.all([
    cache.invalidate("match-history", userId),
    cache.invalidate("shared-jobs-board", "global"),
  ]);

  return {
    message: "Analise recalculada com sucesso.",
    analysis: analysisRow,
    result: {
      ...buildResultPayload({
        result,
        profile,
        targetTitle,
        metadata,
        savedResume,
        jobAnalysis: analysisRow,
        globalScore: comparison.globalScore,
        globalAnalysisStatus: comparison.globalAnalysisStatus,
        analysisStatus,
      }),
      resume: compiledResume,
    },
  };
}

async function getAnalysis(userId, id) {
  const row = await prisma.jobAnalysis.findFirst({
    where: { id, userId },
    include: {
      selectedSubprofile: { select: { id: true, profileName: true } },
      generatedResume: { select: { id: true, generatedFileName: true } },
      parentAnalysis: { select: { id: true, version: true, matchScore: true, selectedProfileName: true, createdAt: true } },
      versions: {
        orderBy: { createdAt: "desc" },
        select: { id: true, version: true, matchScore: true, selectedProfileName: true, analysisStatus: true, createdAt: true },
      },
      applications: {
        where: { userId },
        orderBy: { data: "desc" },
        select: {
          id: true,
          status: true,
          fase: true,
          linkVaga: true,
          linkCV: true,
          optimizedResumeId: true,
          matchingSnapshot: true,
          data: true,
        },
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
  const removedAnalysis = await prisma.jobAnalysis.deleteMany({ where: { id, userId, generatedResumeId: null } });
  if (removedAnalysis.count) {
    await cache.invalidate("match-history", userId);
    return { message: "Removido" };
  }
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
  recalculateAnalysis,
  analyzeProfile,
  getMissingResumeFields,
  assertProfileReadyForResume,
  inferSeniority,
  analysisStatusToJobUpdate,
};
