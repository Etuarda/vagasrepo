jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("../profile.service", () => ({}));
jest.mock("../pdf-output.service", () => ({ generateOptimizedResumePdf: jest.fn() }));

const { analyzeProfile, getMissingResumeFields, assertProfileReadyForResume } = require("../matching.service");

describe("deterministic matching", () => {
  it("nao transforma skill ausente em skill do usuario e usa pesos explicaveis", () => {
    const result = analyzeProfile({
      skillItems: [{ name: "Node.js", category: "backend" }],
      projects: [],
      courses: [],
      certifications: [],
      experiences: [],
    }, "Vaga backend com Node.js, PostgreSQL e Docker para APIs REST.");

    expect(result.matchedSkills).toEqual(["Node.js"]);
    expect(result.missingSkills).toEqual(expect.arrayContaining(["postgresql", "docker", "api-rest"]));
    expect(result.matchedSkills).not.toContain("PostgreSQL");
    expect(result.scoreDetails).toEqual(expect.objectContaining({
      skillsMatchScore: expect.any(Number),
      projectsMatchScore: 0,
      coursesAndCertificationsMatchScore: 0,
      experiencesMatchScore: 0,
    }));
  });

  it("ignora projetos sem titulo estrutural valido", () => {
    const result = analyzeProfile({
      skillItems: [{ name: "Node.js", category: "backend" }],
      projects: [{ id: "invalid", title: "Implementação de um API Gateway centralizado", description: "Node.js", technologies: ["Node.js"], bullets: [] }],
      courses: [],
      certifications: [],
      experiences: [],
    }, "Vaga backend Node.js e APIs REST.");

    expect(result.selectedProjects).toEqual([]);
    expect(result.warnings.join(" ")).toContain("Projetos sem estrutura valida");
    expect(result.warnings.join(" ")).toContain("Nao ha projetos estruturados");
  });

  it("bloqueia geracao se dados manuais minimos estiverem incompletos", () => {
    const missing = getMissingResumeFields({
      name: "Pessoa",
      emailContact: "",
      phone: "",
      summary: "",
      skillItems: [],
      projects: [],
      educations: [],
      experiences: [],
      languages: [{ name: "Ingles", level: "" }],
    });

    expect(missing).toEqual(expect.arrayContaining([
      "dados pessoais (nome e e-mail ou telefone)",
      "resumo profissional",
      "habilidades",
      "pelo menos 1 formacao ou experiencia",
      "pelo menos 1 projeto estruturado",
      "nivel dos idiomas cadastrados",
    ]));
    expect(() => assertProfileReadyForResume({
      name: "Pessoa",
      emailContact: "",
      summary: "",
      skillItems: [],
      projects: [],
      educations: [],
      experiences: [],
      languages: [],
    })).toThrow("Complete o perfil antes de gerar o curriculo otimizado");
  });
});
