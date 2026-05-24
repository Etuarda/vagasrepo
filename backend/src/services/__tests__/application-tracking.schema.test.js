const { createApplicationFromAnalysisSchema } = require("../../schemas/job.schema");

describe("create application from analysis validation", () => {
  it("aplica fase e flags iniciais sem considerar curriculo como aplicado", () => {
    const payload = createApplicationFromAnalysisSchema.parse({ linkVaga: "https://example.com/vaga" });
    expect(payload).toEqual(expect.objectContaining({
      fase: "Currículo gerado",
      acaoNecessaria: false,
      feedbackBool: false,
      confirmDuplicate: false,
    }));
  });

  it("exige descricao quando ha acao ou feedback", () => {
    expect(() => createApplicationFromAnalysisSchema.parse({
      linkVaga: "https://example.com/vaga",
      acaoNecessaria: true,
    })).toThrow();
    expect(() => createApplicationFromAnalysisSchema.parse({
      linkVaga: "https://example.com/vaga",
      feedbackBool: true,
    })).toThrow();
  });
});
