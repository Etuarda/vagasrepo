const { normalizeTerm, normalizeText, extractTechnicalKeywords, classifyJob } = require("../../modules/matching/keyword-normalizer");

describe("keyword normalizer", () => {
  it("normaliza aliases tecnicos para termos canonicos", () => {
    expect(normalizeTerm("Node.js")).toBe("nodejs");
    expect(normalizeTerm("Postgres")).toBe("postgresql");
    expect(normalizeText("API REST com Power BI e Docker Compose")).toContain("api-rest");
    expect(normalizeText("API REST com Power BI e Docker Compose")).toContain("power-bi");
    expect(normalizeText("API REST com Power BI e Docker Compose")).toContain("docker-compose");
  });

  it("classifica vaga backend por keywords reconhecidas", () => {
    const result = classifyJob("Backend Node.js, Express, APIs REST, JWT, Prisma e PostgreSQL.");
    expect(result.category).toBe("backend");
    expect(extractTechnicalKeywords("ReactJS e TypeScript")).toEqual(expect.arrayContaining(["react", "typescript"]));
  });
});
