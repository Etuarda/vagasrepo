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

const { prisma } = require("../../lib/prisma");
const subscriptionService = require("../../services/subscription.service");
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

  it("grava somente metadados publicos e nao persiste descricao para ATS compartilhado", async () => {
    const db = { sharedMatchedJob: { create: jest.fn().mockResolvedValue({ id: "shared" }) } };

    await createSharedMatchedJob(db, {
      jobTitle: "Backend Developer",
      company: "Empresa",
      linkVaga: "https://example.com/vaga",
      jobDescription: "Descricao privada nao deve alimentar o mural.",
    });

    expect(db.sharedMatchedJob.create).toHaveBeenCalledWith({
      data: {
        jobTitle: "Backend Developer",
        company: "Empresa",
        jobUrl: "https://example.com/vaga",
        jobDescription: "",
        confirmedSeniority: "unknown",
        inferredSeniority: "unknown",
      },
    });
  });

  it("consulta o periodo solicitado sem calcular ATS por usuario", async () => {
    await listSharedMatchedJobs("user", "week");

    expect(subscriptionService.assertFeatureAccess).toHaveBeenCalledWith("user", "shared_matched_jobs");
    expect(prisma.sharedMatchedJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { gte: expect.any(Date) } },
      orderBy: { createdAt: "desc" },
      select: expect.not.objectContaining({ jobDescription: true }),
    }));
    expect(prisma.job.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { data: { gte: expect.any(Date) } },
      orderBy: { data: "desc" },
      select: expect.objectContaining({ titulo: true, empresa: true, linkVaga: true }),
    }));
  });

  it("retorna vagas compartilhadas sem score, skills, gaps ou descricao completa", async () => {
    prisma.sharedMatchedJob.findMany.mockResolvedValue([{
      id: "shared",
      jobTitle: "Frontend Developer",
      company: "Empresa",
      jobUrl: "https://example.com/frontend",
      createdAt: new Date(),
    }]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows).toEqual([expect.objectContaining({
      id: "shared",
      jobTitle: "Frontend Developer",
      company: "Empresa",
      jobUrl: "https://example.com/frontend",
      origin: "matching",
    })]);
    expect(rows[0]).not.toHaveProperty("jobDescription");
    expect(rows[0]).not.toHaveProperty("globalMatch");
    expect(rows[0]).not.toHaveProperty("profileMatch");
    expect(rows[0]).not.toHaveProperty("bestSubprofileMatch");
    expect(rows[0]).not.toHaveProperty("matchedSkills");
    expect(rows[0]).not.toHaveProperty("missingSkills");
  });

  it("inclui vagas cadastradas em acompanhamento no painel global", async () => {
    prisma.job.findMany.mockResolvedValue([{
      id: "application",
      titulo: "Frontend Developer",
      empresa: "Empresa",
      linkVaga: "https://example.com/frontend",
      data: new Date(),
    }]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows).toEqual([expect.objectContaining({
      jobTitle: "Frontend Developer",
      company: "Empresa",
      jobUrl: "https://example.com/frontend",
      origin: "tracking",
    })]);
    expect(rows[0]).not.toHaveProperty("jobDescription");
  });

  it("nao duplica vaga compartilhada pelos dois fluxos e prefere a mais recente", () => {
    const rows = dedupeLatestJobs([
      { id: "match", jobTitle: "Backend", company: "Empresa", jobUrl: "https://example.com/vaga", createdAt: new Date("2026-05-24"), origin: "matching" },
      { id: "job", jobTitle: " backend ", company: "EMPRESA", jobUrl: "https://example.com/vaga", createdAt: new Date("2026-05-26"), origin: "tracking" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("job");
  });

  it("calcula as janelas de dia, semana e mes", () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    expect(periodCutoff("day", now).toISOString()).toBe("2026-05-24T12:00:00.000Z");
    expect(periodCutoff("week", now).toISOString()).toBe("2026-05-18T12:00:00.000Z");
    expect(periodCutoff("month", now).toISOString()).toBe("2026-04-25T12:00:00.000Z");
  });
});
