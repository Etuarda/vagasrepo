jest.mock("../../lib/prisma", () => ({
  prisma: {
    jobAnalysis: { findMany: jest.fn() },
  },
}));
jest.mock("../../lib/cache", () => ({
  remember: jest.fn((namespace, owner, variant, loader) => loader()),
  invalidate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../profile.service", () => ({
  resolveProfile: jest.fn(),
}));
jest.mock("../pdf-output.service", () => ({ generateOptimizedResumePdf: jest.fn() }));
jest.mock("../subscription.service", () => ({ consumeMatchingQuota: jest.fn() }));

const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const profileService = require("../profile.service");
const { listHistory } = require("../matching.service");

function makeRow(analysisId) {
  return {
    id: analysisId,
    jobTitle: "Backend Dev",
    company: "Empresa",
    jobUrl: "",
    jobOrigin: "individual",
    selectedProfileType: "global",
    selectedProfileName: "Perfil Global",
    selectedSubprofileId: "profile",
    matchScore: 70,
    globalScore: 70,
    globalAnalysisStatus: "complete",
    selectedProfileScore: 70,
    skillsScore: 70,
    projectsScore: 70,
    matchedSkills: [],
    missingSkills: [],
    extraRelevantSkills: [],
    selectedProjectIds: [],
    selectedCourseIds: [],
    selectedCertificationIds: [],
    selectedProjectsSnapshot: null,
    selectedCoursesSnapshot: null,
    selectedCertificationsSnapshot: null,
    confirmedSeniority: "unknown",
    inferredSeniority: "unknown",
    analysisStatus: "complete",
    warnings: [],
    scoringVersion: "deterministic-v3",
    recalculationReason: "initial",
    sourceAnalysisId: null,
    parentAnalysisId: null,
    version: 1,
    status: "Currículo gerado",
    jobCategory: "unknown",
    appliedAt: null,
    createdAt: new Date(),
    selectedSubprofile: null,
    generatedResume: null,
    applications: [],
  };
}

describe("permanent matching history", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.jobAnalysis.findMany.mockResolvedValue([]);
    profileService.resolveProfile.mockResolvedValue({ id: "profile" });
  });

  it("lista historico completo sem corte temporal ou exclusao automatica", async () => {
    await listHistory("user", "profile");

    expect(prisma.jobAnalysis.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "user", selectedSubprofileId: "profile" },
      orderBy: { createdAt: "desc" },
    }));
    expect(prisma.jobAnalysis.findMany.mock.calls[0][0]).not.toHaveProperty("take");
  });

  it("retorna listagem leve sem descricao da vaga ou PDF gerado", async () => {
    await listHistory("user", "profile");

    const query = prisma.jobAnalysis.findMany.mock.calls[0][0];
    expect(query.select).toEqual(expect.objectContaining({
      id: true,
      jobTitle: true,
      company: true,
      generatedResume: { select: { id: true, generatedFileName: true, resumeFileId: true } },
    }));
    expect(query.select.jobDescription).toBeUndefined();
    expect(query.select.generatedResume.select.generatedPdf).toBeUndefined();
  });

  it("nao consulta o perfil novamente quando o historico esta em cache", async () => {
    cache.remember.mockResolvedValueOnce([]);

    await listHistory("cached-user", "profile");

    expect(cache.remember).toHaveBeenCalledWith("match-history", "cached-user", "profile", expect.any(Function), 2 * 60);
    expect(profileService.resolveProfile).not.toHaveBeenCalled();
    expect(prisma.jobAnalysis.findMany).not.toHaveBeenCalled();
  });

  it("retorna primeira pagina com nextCursor quando ha mais itens que o limite", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => makeRow(`id-${String(i).padStart(2, "0")}`));
    prisma.jobAnalysis.findMany.mockResolvedValue(rows);

    const result = await listHistory("user", "profile", { limit: 20 });

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).toBe("id-19");
  });

  it("retorna nextCursor null quando ha menos itens que o limite", async () => {
    const rows = Array.from({ length: 5 }, (_, i) => makeRow(`id-${i}`));
    prisma.jobAnalysis.findMany.mockResolvedValue(rows);

    const result = await listHistory("user", "profile", { limit: 20 });

    expect(result.items).toHaveLength(5);
    expect(result.nextCursor).toBeNull();
  });

  it("pagina a partir do cursor informado retornando itens subsequentes", async () => {
    const rows = Array.from({ length: 10 }, (_, i) => makeRow(`row-${i}`));
    cache.remember.mockResolvedValue(rows.map((row) => ({
      id: row.id,
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
      selectedProfileName: row.selectedProfileName,
      selectedSubprofileId: row.selectedSubprofileId,
      skillsScore: row.skillsScore,
      projectsScore: row.projectsScore,
      matchedSkills: [],
      missingSkills: [],
      extraRelevantSkills: [],
      selectedProjectIds: [],
      selectedCourseIds: [],
      selectedCertificationIds: [],
      selectedProjects: [],
      selectedCourses: [],
      selectedCertifications: [],
      confirmedSeniority: row.confirmedSeniority,
      inferredSeniority: row.inferredSeniority,
      analysisStatus: row.analysisStatus,
      warnings: [],
      scoringVersion: row.scoringVersion,
      recalculationReason: row.recalculationReason,
      sourceAnalysisId: null,
      version: row.version,
      jobOrigin: row.jobOrigin,
      status: row.status,
      jobCategory: row.jobCategory,
      generatedFileName: null,
      resumeFileId: null,
      application: null,
      appliedAt: null,
      createdAt: row.createdAt,
    })));

    const page1 = await listHistory("user", "profile", { limit: 3 });
    expect(page1.items).toHaveLength(3);
    expect(page1.nextCursor).toBe("row-2");

    const page2 = await listHistory("user", "profile", { limit: 3, cursor: "row-2" });
    expect(page2.items[0].analysisId).toBe("row-3");
    expect(page2.nextCursor).toBe("row-5");
  });
});
