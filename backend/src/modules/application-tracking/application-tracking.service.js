const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const subscriptionService = require("../../services/subscription.service");
const { APPLICATION_PHASES } = require("../../constants/application-status");
const { recordApplicationStatusHistory } = require("./application-history.service");

const linkedJobInclude = {
  jobAnalysis: {
    select: {
      id: true,
      matchScore: true,
      globalScore: true,
      selectedProfileScore: true,
      selectedProfileName: true,
      selectedProfileType: true,
      skillsScore: true,
      projectsScore: true,
      analysisStatus: true,
      warnings: true,
      matchedSkills: true,
      missingSkills: true,
      selectedProjectIds: true,
      selectedCourseIds: true,
      selectedCertificationIds: true,
      scoringVersion: true,
      status: true,
      appliedAt: true,
      selectedSubprofile: { select: { id: true, profileName: true } },
    },
  },
  optimizedResume: { select: { id: true, generatedFileName: true, selectedProjects: true } },
  statusHistory: {
    orderBy: { createdAt: "desc" },
    take: 20,
  },
};

function phaseToAnalysisUpdate(fase, appliedAt) {
  if (!APPLICATION_PHASES.includes(fase)) return null;
  return {
    status: fase,
    ...(fase === "Aplicada" ? { appliedAt: appliedAt || new Date() } : {}),
  };
}

function matchingSnapshotFromAnalysis(analysis) {
  if (!analysis) return null;
  return {
    analysisId: analysis.id,
    overallScore: analysis.matchScore,
    globalScore: analysis.globalScore,
    selectedProfileScore: analysis.selectedProfileScore,
    selectedProfileName: analysis.selectedProfileName,
    selectedProfileType: analysis.selectedProfileType,
    skillsScore: analysis.skillsScore,
    projectsScore: analysis.projectsScore,
    analysisStatus: analysis.analysisStatus,
    matchedSkills: analysis.matchedSkills || [],
    missingSkills: analysis.missingSkills || [],
    selectedProjectIds: analysis.selectedProjectIds || [],
    selectedCourseIds: analysis.selectedCourseIds || [],
    selectedCertificationIds: analysis.selectedCertificationIds || [],
    warnings: analysis.warnings || [],
    scoringVersion: analysis.scoringVersion,
  };
}

async function createFromAnalysis(userId, analysisId, payload) {
  const analysis = await prisma.jobAnalysis.findFirst({
    where: { id: analysisId, userId },
    include: {
      generatedResume: { select: { id: true } },
    },
  });
  if (!analysis) {
    const err = new Error("Analise nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  if (!analysis.generatedResume) {
    const err = new Error("A analise nao possui curriculo gerado");
    err.statusCode = 400;
    throw err;
  }
  const linkVaga = payload.linkVaga || analysis.jobUrl;
  if (!linkVaga) {
    const err = new Error("Informe o link da vaga para cadastrar a candidatura");
    err.statusCode = 400;
    throw err;
  }

  const previous = await prisma.job.findFirst({ where: { userId, jobAnalysisId: analysisId }, select: { id: true } });
  if (previous && !payload.confirmDuplicate) {
    const err = new Error("Esta analise ja possui candidatura. Confirme para registrar outra candidatura.");
    err.statusCode = 409;
    throw err;
  }

  const job = await prisma.$transaction(async (tx) => {
    await subscriptionService.assertApplicationTrackingLimit(userId, tx);
    const created = await tx.job.create({
      data: {
        userId,
        titulo: analysis.jobTitle,
        empresa: analysis.company || "Empresa nao informada",
        jobDescription: analysis.jobDescription,
        jobAnalysisId: analysis.id,
        optimizedResumeId: analysis.generatedResume.id,
        matchingSnapshot: matchingSnapshotFromAnalysis(analysis),
        linkVaga,
        linkCV: payload.linkCV,
        data: new Date(),
        status: payload.fase === "Encerrada" ? "Encerrada" : "Ativa",
        fase: payload.fase,
        acaoNecessaria: payload.acaoNecessaria,
        qualAcao: payload.acaoNecessaria ? payload.qualAcao : null,
        prazoAcao: payload.acaoNecessaria ? (payload.prazoAcao || null) : null,
        feedbackBool: payload.feedbackBool,
        feedbackTxt: payload.feedbackBool ? payload.feedbackTxt : null,
        notes: payload.notes,
      },
      include: linkedJobInclude,
    });

    await recordApplicationStatusHistory(tx, {
      userId,
      jobId: created.id,
      novoStatus: created.status,
      novaFase: created.fase,
      observacao: "Candidatura criada a partir do matching.",
    });

    const analysisUpdate = phaseToAnalysisUpdate(payload.fase, analysis.appliedAt);
    if (analysisUpdate && analysis.status !== payload.fase) {
      await tx.jobAnalysis.update({
        where: { id: analysis.id },
        data: analysisUpdate,
      });
    }
    return created;
  });
  await Promise.all([
    cache.invalidate("jobs", userId),
    cache.invalidate("match-history", userId),
    cache.invalidate("shared-jobs-board", "global"),
  ]);

  return {
    message: "Candidatura registrada com sucesso.",
    job,
  };
}

module.exports = { createFromAnalysis, linkedJobInclude, matchingSnapshotFromAnalysis };
