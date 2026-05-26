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
});
