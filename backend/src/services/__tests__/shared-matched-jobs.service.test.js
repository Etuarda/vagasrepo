jest.mock("../../lib/prisma", () => ({
  prisma: {
    sharedMatchedJob: {
      findMany: jest.fn(),
    },
    job: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock("../../lib/cache", () => ({
  remember: jest.fn((namespace, owner, variant, loader) => loader()),
}));
jest.mock("../../services/subscription.service", () => ({
  assertFeatureAccess: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../services/profile.service", () => ({
  listProfiles: jest.fn().mockResolvedValue([{ id: "global", isGlobal: true, profileName: "Perfil Global" }]),
  getProfile: jest.fn().mockResolvedValue({
    id: "global",
    profileName: "Perfil Global",
    isGlobal: true,
    seniority: "junior",
    skillItems: [{ name: "React" }],
    projects: [],
    courses: [],
    certifications: [],
    educations: [],
  }),
}));

const { prisma } = require("../../lib/prisma");
const subscriptionService = require("../../services/subscription.service");
const profileService = require("../../services/profile.service");
const { evaluateJobMatch } = require("../../modules/matching/job-match-evaluator.service");
const {
  createSharedMatchedJob,
  dedupeLatestJobs,
  listSharedMatchedJobs,
  periodCutoff,
} = require("../../modules/matching/shared-matched-jobs.service");

const baseJob = {
  id: "shared",
  jobTitle: "Frontend Developer",
  company: "Empresa",
  jobUrl: "https://example.com/vaga",
  jobDescription: "Vaga com React e acessibilidade.",
  createdAt: new Date(),
};

describe("shared matched jobs", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.sharedMatchedJob.findMany.mockResolvedValue([]);
    prisma.job.findMany.mockResolvedValue([]);
  });

  it("grava metadados e descricao para calcular aderencia no painel compartilhado", async () => {
    const db = { sharedMatchedJob: { create: jest.fn().mockResolvedValue({ id: "shared" }) } };

    await createSharedMatchedJob(db, {
      jobTitle: "Backend Developer",
      company: "Empresa",
      linkVaga: "https://example.com/vaga",
      jobDescription: "Nao deve ser compartilhada.",
    });

    expect(db.sharedMatchedJob.create).toHaveBeenCalledWith({
      data: {
        jobTitle: "Backend Developer",
        company: "Empresa",
        jobUrl: "https://example.com/vaga",
        jobDescription: "Nao deve ser compartilhada.",
        confirmedSeniority: "unknown",
        inferredSeniority: "unknown",
      },
    });
  });

  it("consulta o periodo solicitado sem filtrar por usuario", async () => {
    await listSharedMatchedJobs("user", "week");

    expect(subscriptionService.assertFeatureAccess).toHaveBeenCalledWith("user", "shared_matched_jobs");
    expect(prisma.sharedMatchedJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { gte: expect.any(Date) } },
      orderBy: { createdAt: "desc" },
    }));
    expect(prisma.job.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { data: { gte: expect.any(Date) } },
      orderBy: { data: "desc" },
      select: expect.objectContaining({ titulo: true, empresa: true, linkVaga: true }),
    }));
  });

  it("inclui vagas cadastradas em acompanhamento no painel global", async () => {
    prisma.job.findMany.mockResolvedValue([{
      id: "application",
      titulo: "Frontend Developer",
      empresa: "Empresa",
      linkVaga: "https://example.com/frontend",
      jobDescription: "Vaga React junior",
      data: new Date(),
    }]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows).toEqual([expect.objectContaining({
      jobTitle: "Frontend Developer",
      company: "Empresa",
      jobUrl: "https://example.com/frontend",
      origin: "tracking",
      globalMatch: expect.objectContaining({ overallScore: expect.any(Number) }),
      profileMatch: expect.objectContaining({ overallScore: expect.any(Number) }),
    })]);
    expect(rows[0]).not.toHaveProperty("jobDescription");
  });

  // --- Consistência entre Matching ATS individual e vagas compartilhadas ---

  it("score de vagas compartilhadas e identico ao score do Matching ATS individual com os mesmos dados", async () => {
    prisma.sharedMatchedJob.findMany.mockResolvedValue([baseJob]);
    const profile = await profileService.getProfile("user");

    const rows = await listSharedMatchedJobs("user", "month");

    const expected = evaluateJobMatch({
      profile,
      jobTitle: baseJob.jobTitle,
      company: baseJob.company,
      jobDescription: baseJob.jobDescription,
    });

    expect(rows[0].globalMatch.overallScore).toBe(expected.overallScore);
    expect(rows[0].globalMatch.analysisStatus).toBe("complete");
    expect(rows[0]).not.toHaveProperty("jobDescription");
  });

  it("globalMatch expoe skillsScore e projectsScore alem de overallScore", async () => {
    prisma.sharedMatchedJob.findMany.mockResolvedValue([baseJob]);
    const profile = await profileService.getProfile("user");
    const expected = evaluateJobMatch({
      profile,
      jobTitle: baseJob.jobTitle,
      company: baseJob.company,
      jobDescription: baseJob.jobDescription,
    });

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows[0].globalMatch.skillsScore).toBe(expected.scores.skills);
    expect(rows[0].globalMatch.projectsScore).toBe(expected.scores.projects);
  });

  // --- jobDescription vazia → analysisStatus incompleto ---

  it("jobDescription vazia gera analysisStatus incomplete e nao exibe 0%", async () => {
    prisma.sharedMatchedJob.findMany.mockResolvedValue([{
      ...baseJob,
      jobDescription: "",
    }]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows[0].globalMatch.analysisStatus).toBe("incomplete");
    expect(rows[0].globalMatch.score).toBeNull();
    expect(rows[0].globalMatch.overallScore).toBeNull();
    expect(rows[0].globalMatch.scoreAvailable).toBe(false);
  });

  it("jobDescription somente com espacos em branco gera analysisStatus incomplete", async () => {
    prisma.sharedMatchedJob.findMany.mockResolvedValue([{
      ...baseJob,
      jobDescription: "   ",
    }]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows[0].globalMatch.analysisStatus).toBe("incomplete");
    expect(rows[0].globalMatch.overallScore).toBeNull();
  });

  // --- Perfil incompleto → analysisStatus incompleto ---

  it("nao exibe 0% quando o perfil esta incompleto", async () => {
    profileService.getProfile.mockResolvedValueOnce({
      id: "global",
      profileName: "Perfil Global",
      isGlobal: true,
      completion: { pending: ["adicione habilidades aprendidas"] },
    });
    prisma.sharedMatchedJob.findMany.mockResolvedValue([{
      ...baseJob,
      jobDescription: "Node.js",
    }]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows[0].profileMatch).toEqual(expect.objectContaining({
      score: null,
      scoreAvailable: false,
      analysisStatus: "incomplete",
    }));
  });

  // --- Subperfis ---

  it("vaga sem subperfil mostra apenas Perfil Global e bestSubprofileMatch null", async () => {
    prisma.sharedMatchedJob.findMany.mockResolvedValue([baseJob]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows[0].globalMatch).toMatchObject({ profileType: "global" });
    expect(rows[0].bestSubprofileMatch).toBeNull();
  });

  it("vaga com subperfil mostra Perfil Global e melhor subperfil separados", async () => {
    profileService.listProfiles.mockResolvedValueOnce([
      { id: "global", isGlobal: true, profileName: "Perfil Global" },
      { id: "sub", isGlobal: false, profileName: "Backend" },
    ]);
    profileService.getProfile
      .mockResolvedValueOnce({
        id: "global",
        profileName: "Perfil Global",
        isGlobal: true,
        seniority: "junior",
        skillItems: [{ name: "React" }],
        projects: [], courses: [], certifications: [], educations: [],
      })
      .mockResolvedValueOnce({
        id: "sub",
        profileName: "Backend",
        isGlobal: false,
        seniority: "junior",
        skillItems: [{ name: "React" }, { name: "Node.js" }],
        projects: [], courses: [], certifications: [], educations: [],
      });
    prisma.sharedMatchedJob.findMany.mockResolvedValue([baseJob]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows[0].globalMatch).toMatchObject({ profileId: "global", profileType: "global" });
    expect(rows[0].bestSubprofileMatch).toMatchObject({ profileId: "sub", profileName: "Backend" });
    expect(rows[0].bestSubprofileMatch.overallScore).toBeGreaterThanOrEqual(0);
  });

  // --- Deduplicação ---

  it("nao duplica vaga compartilhada pelos dois fluxos", () => {
    const rows = dedupeLatestJobs([
      { id: "match", jobTitle: "Backend", company: "Empresa", jobUrl: "https://example.com/vaga", jobDescription: "Node.js vaga backend.", createdAt: new Date("2026-05-24"), origin: "matching" },
      { id: "job", jobTitle: " backend ", company: "EMPRESA", jobUrl: "https://example.com/vaga", jobDescription: "", createdAt: new Date("2026-05-23"), origin: "tracking" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("match");
  });

  it("prefere entrada com jobDescription quando a outra e mais recente mas sem descricao", () => {
    const rows = dedupeLatestJobs([
      { id: "tracking-newer", jobTitle: "Backend", company: "Empresa", jobUrl: "https://example.com/vaga", jobDescription: "", createdAt: new Date("2026-05-26"), origin: "tracking" },
      { id: "matching-older", jobTitle: "Backend", company: "Empresa", jobUrl: "https://example.com/vaga", jobDescription: "Node.js PostgreSQL Docker.", createdAt: new Date("2026-05-24"), origin: "matching" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("matching-older");
  });

  it("calcula as janelas de dia, semana e mes", () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    expect(periodCutoff("day", now).toISOString()).toBe("2026-05-24T12:00:00.000Z");
    expect(periodCutoff("week", now).toISOString()).toBe("2026-05-18T12:00:00.000Z");
    expect(periodCutoff("month", now).toISOString()).toBe("2026-04-25T12:00:00.000Z");
  });
});
