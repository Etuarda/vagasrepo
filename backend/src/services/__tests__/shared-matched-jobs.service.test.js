jest.mock("../../lib/prisma", () => ({
  prisma: {
    sharedMatchedJob: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock("../../lib/cache", () => ({
  remember: jest.fn((namespace, owner, variant, loader) => loader()),
}));

const { prisma } = require("../../lib/prisma");
const {
  createSharedMatchedJob,
  listSharedMatchedJobs,
  periodCutoff,
} = require("../../modules/matching/shared-matched-jobs.service");

describe("shared matched jobs", () => {
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
    prisma.sharedMatchedJob.findMany.mockResolvedValue([]);

    await listSharedMatchedJobs("week");

    expect(prisma.sharedMatchedJob.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { createdAt: { gte: expect.any(Date) } },
      orderBy: { createdAt: "desc" },
    }));
  });

  it("calcula as janelas de dia, semana e mes", () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    expect(periodCutoff("day", now).toISOString()).toBe("2026-05-24T12:00:00.000Z");
    expect(periodCutoff("week", now).toISOString()).toBe("2026-05-18T12:00:00.000Z");
    expect(periodCutoff("month", now).toISOString()).toBe("2026-04-25T12:00:00.000Z");
  });
});
