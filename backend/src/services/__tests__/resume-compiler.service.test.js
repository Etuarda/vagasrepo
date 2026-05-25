const { compileResume } = require("../../modules/resume/resume-compiler.service");

describe("resume compiler", () => {
  const profile = {
    name: "Pessoa Teste",
    title: "Backend Developer",
    location: "Fortaleza/CE",
    cep: "60123-456",
    emailContact: "pessoa@example.com",
    phone: "85999999999",
    linkedin: "https://linkedin.com/in/pessoa",
    github: "https://github.com/pessoa",
    lattes: "https://lattes.cnpq.br/pessoa",
    summary: "Profissional backend com entrega de APIs e persistencia relacional sem texto reescrito.",
    skillItems: [
      { name: "Node.js", category: "backend" },
      { name: "PostgreSQL", category: "database" },
      { name: "Docker", category: "devops" },
      { name: "Git", category: "other" },
      { name: "Scrum", category: "other" },
      { name: "React", category: "frontend" },
    ],
    courses: [
      { id: "c1", title: "Node Avancado", institution: "Escola", period: "2025", description: "Conteudo cadastrado." },
      { id: "c2", title: "Docker", institution: "Academia", period: "2024", description: "" },
    ],
    certifications: [{ id: "cert1", title: "AWS", issuer: "Amazon", period: "2025", credentialUrl: "https://example.com/cert" }],
    educations: [{ title: "ADS", institution: "Universidade", period: "2024 - 2027" }],
    experiences: [{ role: "Desenvolvedora", company: "Empresa", period: "2023 - atual", description: "Atividade integral cadastrada pelo usuario." }],
    languages: [{ name: "Ingles", level: "Intermediario - B1" }],
  };
  const match = {
    targetTitle: "Backend",
    matchedSkills: ["Node.js", "PostgreSQL"],
    selectedProjects: [{
      id: "p1",
      title: "API",
      category: "backend",
      shortDescription: "Resumo curto exatamente cadastrado pelo usuario.",
      stack: "Node.js, PostgreSQL",
      repositoryUrl: "https://github.com/pessoa/api",
      deployUrl: "https://api.example.com",
    }],
  };

  it("preserva secoes fixas e adapta apenas skills e projetos", () => {
    const resume = compileResume({ profile, matchResult: match });
    expect(resume.header.title).toBe(profile.title);
    expect(resume.header.cep).toBe(profile.cep);
    expect(resume.summary).toBe(profile.summary);
    expect(resume.education).toEqual(profile.educations);
    expect(resume.experiences[0].description).toBe(profile.experiences[0].description);
    expect(resume.courses).toEqual(profile.courses);
    expect(resume.certifications).toEqual(profile.certifications);
    expect(resume.languagesInline).toBe("Ingles - Intermediario - B1");
    expect(resume.skillsInline).toContain("Backend: Node.js");
    expect(resume.skillsInline).toContain("Praticas/Versionamento: Git, Scrum");
    expect(resume.skillsInline).not.toContain("Docker");
    expect(resume.skillsInline).not.toContain("React");
    expect(resume.projects[0].summary).toBe("Resumo curto exatamente cadastrado pelo usuario.");
    expect(resume.projects[0]).not.toHaveProperty("stack");
    expect(resume.projects[0]).not.toHaveProperty("bullets");
  });

  it("nao usa descricao legada como resumo de projeto", () => {
    const resume = compileResume({
      profile,
      matchResult: { ...match, selectedProjects: [{ id: "legacy", title: "Legado", description: "API cadastrada anteriormente." }] },
    });
    expect(resume.projects[0].summary).toBe("");
  });
});
