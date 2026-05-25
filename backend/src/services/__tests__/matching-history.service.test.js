jest.mock("../../lib/prisma", () => ({
  prisma: {
    jobAnalysis: {
      deleteMany: jest.fn(),
      findMany: jest.fn(),
    },
    optimizedResume: {
      deleteMany: jest.fn(),
    },
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

const { prisma } = require("../../lib/prisma");
const profileService = require("../profile.service");
const {
  MATCH_HISTORY_RETENTION_DAYS,
  historyRetentionCutoff,
  listHistory,
  purgeExpiredHistory,
} = require("../matching.service");

describe("matching history retention", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.jobAnalysis.deleteMany.mockResolvedValue({ count: 0 });
    prisma.optimizedResume.deleteMany.mockResolvedValue({ count: 0 });
    prisma.jobAnalysis.findMany.mockResolvedValue([]);
    profileService.resolveProfile.mockResolvedValue({ id: "profile" });
  });

  it("define prazo de disponibilidade de 30 dias", () => {
    const cutoff = historyRetentionCutoff(new Date("2026-05-25T12:00:00.000Z"));

    expect(MATCH_HISTORY_RETENTION_DAYS).toBe(30);
    expect(cutoff.toISOString()).toBe("2026-04-25T12:00:00.000Z");
  });

  it("remove analises vencidas e curriculos antigos sem analise ativa", async () => {
    const now = new Date("2026-05-25T12:00:00.000Z");
    const cutoff = await purgeExpiredHistory("user", now);

    expect(prisma.jobAnalysis.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user", createdAt: { lt: cutoff } },
    });
    expect(prisma.optimizedResume.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user",
        createdAt: { lt: cutoff },
        generatedForAnalyses: { none: {} },
      },
    });
  });

  it("lista somente historico dentro da retencao", async () => {
    await listHistory("user", "profile");

    expect(prisma.jobAnalysis.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        userId: "user",
        selectedSubprofileId: "profile",
        createdAt: { gte: expect.any(Date) },
      },
    }));
  });

  it("nao bloqueia a listagem enquanto a limpeza fisica esta pendente", async () => {
    prisma.jobAnalysis.deleteMany.mockReturnValue(new Promise(() => {}));

    await expect(listHistory("fast-user", "profile")).resolves.toEqual([]);
    expect(prisma.jobAnalysis.findMany).toHaveBeenCalled();
  });
});
