const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const subscriptionService = require("../../services/subscription.service");

const linkedJobInclude = {
  jobAnalysis: {
    select: {
      id: true,
      matchScore: true,
      matchedSkills: true,
      missingSkills: true,
      selectedProjectIds: true,
      status: true,
      appliedAt: true,
      selectedSubprofile: { select: { id: true, profileName: true } },
    },
  },
  optimizedResume: { select: { id: true, generatedFileName: true, selectedProjects: true } },
};

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
        linkVaga,
        linkCV: payload.linkCV,
        data: new Date(),
        status: "Ativa",
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

    if (payload.fase === "Aplicada" && analysis.status !== "applied") {
      await tx.jobAnalysis.update({
        where: { id: analysis.id },
        data: { status: "applied", appliedAt: analysis.appliedAt || new Date() },
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

module.exports = { createFromAnalysis, linkedJobInclude };
