jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    job: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));
jest.mock("../../lib/cache", () => ({
  remember: jest.fn((namespace, owner, variant, loader) => loader()),
  invalidate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../../modules/application-tracking/application-tracking.service", () => ({
  linkedJobInclude: {},
}));
jest.mock("../subscription.service", () => ({
  assertApplicationTrackingLimit: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const subscriptionService = require("../subscription.service");
const { listJobs, createJob, updateJob } = require("../jobs.service");
const { jobListQuerySchema } = require("../../schemas/job.schema");

describe("job list pagination", () => {
  beforeEach(() => jest.clearAllMocks());

  it("aceita cursor para evitar offset crescente em listas extensas", async () => {
    await listJobs("user", { cursor: "11111111-1111-4111-8111-111111111111", limit: 20 });

    expect(prisma.job.findMany).toHaveBeenCalledWith(expect.objectContaining({
      cursor: { id: "11111111-1111-4111-8111-111111111111" },
      skip: 1,
      take: 20,
      orderBy: [{ data: "desc" }, { id: "desc" }],
    }));
  });

  it("recusa paginacao por offset alem da primeira pagina", () => {
    expect(() => jobListQuerySchema.parse({ page: "2" })).toThrow("Use cursor");
  });

  it("filtra vagas pelo mes vigente do calendario", async () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 4, 27, 12, 0, 0));
    try {
      await listJobs("user", { period: "currentMonth" });

      expect(jobListQuerySchema.parse({ period: "currentMonth" }).period).toBe("currentMonth");
      expect(prisma.job.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: {
          userId: "user",
          AND: [{ data: { gte: new Date(2026, 4, 1), lt: new Date(2026, 5, 1) } }],
        },
      }));
    } finally {
      jest.useRealTimers();
    }
  });

  it("valida quota antes de cadastrar nova vaga acompanhada", async () => {
    prisma.job.create.mockResolvedValue({ id: "job" });
    prisma.$transaction.mockImplementation((work) => work(prisma));

    await createJob("user", { titulo: "Backend" });

    expect(subscriptionService.assertApplicationTrackingLimit).toHaveBeenCalledWith("user", prisma);
    expect(prisma.job.create).toHaveBeenCalled();
  });

  it("bloqueia a decima primeira vaga manual do Free antes da criacao", async () => {
    const err = Object.assign(new Error("Limite atingido"), { statusCode: 402 });
    subscriptionService.assertApplicationTrackingLimit.mockRejectedValueOnce(err);
    prisma.$transaction.mockImplementation((work) => work(prisma));

    await expect(createJob("user", { titulo: "Backend" })).rejects.toMatchObject({ statusCode: 402 });

    expect(prisma.job.create).not.toHaveBeenCalled();
  });

  it("nao invalida historico ao editar candidatura sem analise vinculada", async () => {
    prisma.job.updateMany.mockResolvedValue({ count: 1 });
    prisma.job.findFirst.mockResolvedValue({ id: "job", jobAnalysisId: null });

    await updateJob("user", "job", { fase: "Triagem" });

    expect(cache.invalidate).not.toHaveBeenCalledWith("match-history", "user");
  });

  it("invalida historico ao editar candidatura associada a analise", async () => {
    prisma.job.updateMany.mockResolvedValue({ count: 1 });
    prisma.job.findFirst.mockResolvedValue({ id: "job", jobAnalysisId: "analysis" });

    await updateJob("user", "job", { fase: "Triagem" });

    expect(cache.invalidate).toHaveBeenCalledWith("match-history", "user");
  });
});
