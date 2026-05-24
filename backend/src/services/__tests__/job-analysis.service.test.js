jest.mock("../../lib/prisma", () => ({
  prisma: {
    jobAnalysis: {
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));
jest.mock("../profile.service", () => ({}));
jest.mock("../pdf-output.service", () => ({ generateOptimizedResumePdf: jest.fn() }));

const { prisma } = require("../../lib/prisma");
const { updateAnalysis } = require("../matching.service");

describe("job analysis status", () => {
  it("registra appliedAt somente para analise pertencente ao usuario", async () => {
    prisma.jobAnalysis.findFirst.mockResolvedValue({ id: "analysis", userId: "user", appliedAt: null });
    prisma.jobAnalysis.update.mockResolvedValue({ status: "applied" });

    await updateAnalysis("user", "analysis", { status: "applied" });

    expect(prisma.jobAnalysis.findFirst).toHaveBeenCalledWith({ where: { id: "analysis", userId: "user" } });
    expect(prisma.jobAnalysis.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "analysis" },
      data: expect.objectContaining({ status: "applied", appliedAt: expect.any(Date) }),
    }));
  });

  it("cria nova versao ao editar conteudo da analise", async () => {
    prisma.jobAnalysis.findFirst.mockResolvedValue({
      id: "analysis", userId: "user", jobTitle: "Backend", company: "", jobDescription: "Descricao de vaga suficientemente longa para teste.",
      selectedSubprofileId: "profile", matchScore: 80, jobCategory: "backend", matchedSkills: [], missingSkills: [],
      selectedProjectIds: [], generatedResumeId: "resume", status: "draft", notes: "", appliedAt: null, version: 1,
    });
    prisma.jobAnalysis.create.mockResolvedValue({ version: 2 });

    await updateAnalysis("user", "analysis", { notes: "Revisada" });

    expect(prisma.jobAnalysis.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ parentAnalysisId: "analysis", version: 2, notes: "Revisada" }),
    });
  });
});
