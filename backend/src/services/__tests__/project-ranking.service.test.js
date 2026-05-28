const { rankProjects } = require("../../modules/matching/project-ranking.service");

const projects = [
  {
    id: "one",
    title: "API de assinaturas",
    category: "backend",
    shortDescription: "API para assinaturas.",
    learnedSkills: ["Node.js", "PostgreSQL", "APIs REST"],
    relevanceWeight: 70,
  },
  {
    id: "two",
    title: "Dashboard",
    category: "frontend",
    shortDescription: "Interface React para indicadores.",
    relevanceWeight: 40,
  },
  {
    id: "three",
    title: "Oculto",
    category: "backend",
    shortDescription: "Servico Node.js.",
    isVisible: false,
  },
];

describe("project ranking", () => {
  it("seleciona no maximo dois projetos visiveis com justificativa", () => {
    const ranked = rankProjects(projects, ["nodejs", "postgresql", "api-rest"], 2);
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe("one");
    expect(ranked.find((item) => item.id === "three")).toBeUndefined();
    expect(ranked[0].reason).toContain("nodejs");
  });

  it("considera habilidades aprendidas, descricao e links, ignorando stack textual legada", () => {
    const ranked = rankProjects([{
      id: "legacy",
      title: "Portal",
      category: "frontend",
      shortDescription: "Tela institucional com API REST documentada.",
      stack: "Node.js, PostgreSQL, APIs REST",
      learnedSkills: ["Node.js", "PostgreSQL"],
      repositoryUrl: "https://github.com/example/api-rest",
      technologies: ["Node.js"],
      technicalSolution: "API REST com PostgreSQL.",
      bullets: [{ content: "Node.js e PostgreSQL.", keywords: ["nodejs"] }],
    }], ["nodejs", "postgresql", "api-rest"], 1);

    expect(ranked[0].matchedKeywords).toEqual(["nodejs", "postgresql", "api-rest"]);
    expect(ranked[0].skillMatchScore).toBe(67);
  });
});
