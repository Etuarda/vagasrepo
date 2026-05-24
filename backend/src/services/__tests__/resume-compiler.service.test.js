const { compileResume } = require("../../modules/resume/resume-compiler.service");

describe("resume compiler", () => {
  const profile = {
    name: "Pessoa Teste",
    title: "Backend Developer",
    location: "Fortaleza/CE",
    emailContact: "pessoa@example.com",
    summary: "Profissional backend com entrega de APIs e persistencia relacional.",
    skillItems: [
      { name: "Node.js", category: "backend" },
      { name: "PostgreSQL", category: "database" },
      { name: "Docker", category: "devops" },
    ],
    courses: [{ id: "c1", title: "Node Avancado", institution: "Escola", period: "2025" }],
    certifications: [],
    educations: [],
    languages: [{ name: "Ingles", level: "B1" }],
  };
  const match = {
    targetTitle: "Backend",
    matchedSkills: ["Node.js", "PostgreSQL"],
    selectedProjects: [{
      id: "p1",
      title: "API",
      technologies: ["Node.js"],
      selectedBullets: [{ content: "Implementei API em Node.js." }, { content: "Integrei PostgreSQL." }, { content: "Configurei testes." }, { content: "Excesso." }],
    }],
    selectedExperiences: [],
    selectedCourses: profile.courses,
    selectedCertifications: [],
  };

  it("gera secoes compactas apenas com dados cadastrados", () => {
    const resume = compileResume({ profile, matchResult: match });
    expect(resume.skillsInline).toContain("Backend: Node.js");
    expect(resume.skillsInline).not.toContain("React");
    expect(resume.projects[0].bullets).toHaveLength(3);
    expect(resume.coursesAndCertificationsInline).toBe("Node Avancado | Escola | 2025");
    expect(resume.layout.skillLines).toBeLessThanOrEqual(2);
    expect(resume.layout.coursesAndCertificationsLines).toBeLessThanOrEqual(2);
  });

  it("usa descricao cadastrada como fallback para projeto legado sem bullets", () => {
    const resume = compileResume({
      profile,
      matchResult: { ...match, selectedProjects: [{ id: "legacy", title: "Legado", description: "API cadastrada anteriormente.", technologies: ["Node.js"] }] },
    });
    expect(resume.projects[0].bullets).toEqual(["API cadastrada anteriormente."]);
  });
});
