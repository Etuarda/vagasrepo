jest.mock("../../lib/prisma", () => ({
  prisma: {
    jobAnalysis: { findFirst: jest.fn() },
    job: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const { prisma } = require("../../lib/prisma");
const { createFromAnalysis } = require("../../modules/application-tracking/application-tracking.service");

describe("application tracking from analysis", () => {
  const analysis = {
    id: "analysis",
    userId: "user",
    jobTitle: "Backend Developer",
    company: "Empresa",
    jobDescription: "Descricao original",
    jobUrl: "https://example.com/original",
    generatedResume: { id: "resume" },
    status: "draft",
    appliedAt: null,
  };
  const payload = {
    linkVaga: "https://example.com/job",
    linkCV: "https://example.com/cv",
    fase: "Currículo gerado",
    acaoNecessaria: false,
    qualAcao: "",
    feedbackBool: false,
    feedbackTxt: "",
    notes: "",
    confirmDuplicate: false,
  };

  beforeEach(() => jest.clearAllMocks());

  it("cria candidatura ativa vinculada sem marcar aplicada ao gerar curriculo", async () => {
    prisma.jobAnalysis.findFirst.mockResolvedValue(analysis);
    prisma.job.findFirst.mockResolvedValue(null);
    const tx = { job: { create: jest.fn().mockResolvedValue({ id: "job", fase: "Currículo gerado", status: "Ativa" }) }, jobAnalysis: { update: jest.fn() } };
    prisma.$transaction.mockImplementation((work) => work(tx));

    const out = await createFromAnalysis("user", "analysis", payload);

    expect(tx.job.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        titulo: "Backend Developer",
        status: "Ativa",
        fase: "Currículo gerado",
        jobAnalysisId: "analysis",
        optimizedResumeId: "resume",
      }),
    }));
    expect(tx.jobAnalysis.update).not.toHaveBeenCalled();
    expect(out.message).toBe("Candidatura registrada com sucesso.");
  });

  it("bloqueia candidatura duplicada sem confirmacao explicita", async () => {
    prisma.jobAnalysis.findFirst.mockResolvedValue(analysis);
    prisma.job.findFirst.mockResolvedValue({ id: "existing" });

    await expect(createFromAnalysis("user", "analysis", payload)).rejects.toMatchObject({ statusCode: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("marca analise aplicada apenas quando a fase foi escolhida pelo usuario", async () => {
    prisma.jobAnalysis.findFirst.mockResolvedValue(analysis);
    prisma.job.findFirst.mockResolvedValue(null);
    const tx = { job: { create: jest.fn().mockResolvedValue({ id: "job" }) }, jobAnalysis: { update: jest.fn() } };
    prisma.$transaction.mockImplementation((work) => work(tx));

    await createFromAnalysis("user", "analysis", { ...payload, fase: "Aplicada" });

    expect(tx.jobAnalysis.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "analysis" },
      data: expect.objectContaining({ status: "applied", appliedAt: expect.any(Date) }),
    }));
  });

  it("reutiliza o link salvo na analise quando o formulario nao informar outro", async () => {
    prisma.jobAnalysis.findFirst.mockResolvedValue(analysis);
    prisma.job.findFirst.mockResolvedValue(null);
    const tx = { job: { create: jest.fn().mockResolvedValue({ id: "job" }) }, jobAnalysis: { update: jest.fn() } };
    prisma.$transaction.mockImplementation((work) => work(tx));

    await createFromAnalysis("user", "analysis", { ...payload, linkVaga: "" });

    expect(tx.job.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ linkVaga: "https://example.com/original" }),
    }));
  });
});
