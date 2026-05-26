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

  it("grava apenas os metadados publicos da vaga", async () => {
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
      data: new Date(),
    }]);

    const rows = await listSharedMatchedJobs("user", "month");

    expect(rows).toEqual([expect.objectContaining({
      jobTitle: "Frontend Developer",
      company: "Empresa",
      jobUrl: "https://example.com/frontend",
      origin: "tracking",
    })]);
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
