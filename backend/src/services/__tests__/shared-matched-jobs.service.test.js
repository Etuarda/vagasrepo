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

  it("usa a mesma logica do avaliador e considera jobDescription sem expor a descricao completa", async () => {
    const job = {
      id: "shared",
      jobTitle: "Vaga Junior",
      company: "Empresa",
      jobUrl: "https://example.com/vaga",
      jobDescription: "Descricao com React e acessibilidade.",
      createdAt: new Date(),
    };
    prisma.sharedMatchedJob.findMany.mockResolvedValue([job]);

    const rows = await listSharedMatchedJobs("user", "month");
    const profile = await profileService.getProfile("user");
    const expected = evaluateJobMatch({
      profile,
      jobTitle: job.jobTitle,
      company: job.company,
      jobDescription: job.jobDescription,
    });

    expect(rows[0]).not.toHaveProperty("jobDescription");
    expect(rows[0].profileMatch).toEqual(expect.objectContaining({
      overallScore: expected.overallScore,
      matchedSkills: expected.matchedSkills.slice(0, 8),
    }));
    expect(rows[0].profileMatch.matchedSkills).toContain("React");
  });

  it("nao duplica vaga compartilhada pelos dois fluxos", () => {
    const rows = dedupeLatestJobs([
      { id: "match", jobTitle: "Backend", company: "Empresa", jobUrl: "https://example.com/vaga", createdAt: new Date("2026-05-24"), origin: "matching" },
      { id: "job", jobTitle: " backend ", company: "EMPRESA", jobUrl: "https://example.com/vaga", createdAt: new Date("2026-05-23"), origin: "tracking" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("match");
  });

  it("calcula as janelas de dia, semana e mes", () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    expect(periodCutoff("day", now).toISOString()).toBe("2026-05-24T12:00:00.000Z");
    expect(periodCutoff("week", now).toISOString()).toBe("2026-05-18T12:00:00.000Z");
    expect(periodCutoff("month", now).toISOString()).toBe("2026-04-25T12:00:00.000Z");
  });
});
