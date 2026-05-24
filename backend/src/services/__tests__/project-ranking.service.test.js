const { rankProjects, selectBullets } = require("../../modules/matching/project-ranking.service");

const projects = [
  {
    id: "one",
    title: "API",
    technologies: ["Node.js", "PostgreSQL"],
    relevanceWeight: 70,
    bullets: [
      { content: "Implementei API REST em Node.js com JWT.", keywords: ["nodejs", "api-rest", "jwt"], weight: 90, isActive: true },
      { content: "Modelei tabelas PostgreSQL para persistencia.", keywords: ["postgresql"], weight: 80, isActive: true },
      { content: "Documentei telas sem relacao com backend.", keywords: ["figma"], weight: 1, isActive: true },
    ],
  },
  { id: "two", title: "Dashboard", technologies: ["React"], bullets: [], relevanceWeight: 40 },
  { id: "three", title: "Oculto", technologies: ["Node.js"], bullets: [], isVisible: false },
];

describe("project ranking", () => {
  it("seleciona no maximo dois projetos visiveis com justificativa", () => {
    const ranked = rankProjects(projects, ["nodejs", "postgresql", "api-rest"], 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe("one");
    expect(ranked.find((item) => item.id === "three")).toBeUndefined();
    expect(ranked[0].reason).toContain("nodejs");
  });

  it("seleciona no maximo tres bullets cadastrados e aderentes", () => {
    const selected = selectBullets(projects[0], ["nodejs", "postgresql", "jwt"], 3);
    expect(selected.length).toBeLessThanOrEqual(3);
    expect(selected.map((item) => item.content).join(" ")).not.toContain("Documentei");
  });
});
