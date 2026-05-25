jest.mock("../../lib/prisma", () => ({
  prisma: {
    jobAnalysis: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));
jest.mock("../../lib/cache", () => ({
  remember: jest.fn((namespace, owner, variant, loader) => loader()),
  invalidate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../profile.service", () => ({}));
jest.mock("../pdf-output.service", () => ({ generateOptimizedResumePdf: jest.fn() }));

const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const { updateAnalysis } = require("../matching.service");

describe("job analysis status", () => {
  it("registra appliedAt somente para analise pertencente ao usuario", async () => {
    prisma.jobAnalysis.findFirst.mockResolvedValue({ id: "analysis", userId: "user", appliedAt: null });
    prisma.jobAnalysis.update.mockResolvedValue({ status: "applied" });

    await updateAnalysis("user", "analysis", { status: "applied" });

    expect(prisma.jobAnalysis.findFirst).toHaveBeenCalledWith({
      where: { id: "analysis", userId: "user", createdAt: { gte: expect.any(Date) } },
    });
    expect(prisma.jobAnalysis.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "analysis" },
      data: expect.objectContaining({ status: "applied", appliedAt: expect.any(Date) }),
    }));
    expect(cache.invalidate).toHaveBeenCalledWith("match-history", "user");
  });

  it("cria nova versao ao editar conteudo da analise", async () => {
    prisma.jobAnalysis.findFirst.mockResolvedValue({
      id: "analysis", userId: "user", jobTitle: "Backend", company: "", jobDescription: "Descricao de vaga suficientemente longa para teste.",
      jobUrl: "https://example.com/vaga",
      selectedSubprofileId: "profile", matchScore: 80, jobCategory: "backend", matchedSkills: [], missingSkills: [],
      selectedProjectIds: [], generatedResumeId: "resume", status: "draft", notes: "", appliedAt: null, version: 1,
    });
    prisma.jobAnalysis.create.mockResolvedValue({ version: 2 });

    await updateAnalysis("user", "analysis", { notes: "Revisada", linkVaga: "https://example.com/nova-vaga" });

    expect(prisma.jobAnalysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parentAnalysisId: "analysis", version: 2, notes: "Revisada", jobUrl: "https://example.com/nova-vaga" }),
    });
    expect(cache.invalidate).toHaveBeenCalledWith("match-history", "user");
  });
});
