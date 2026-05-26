jest.mock("../../lib/prisma", () => ({
  prisma: {
    job: {
      findMany: jest.fn().mockResolvedValue([]),
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

const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const { listJobs, updateJob } = require("../jobs.service");
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
