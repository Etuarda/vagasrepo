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
    objective: "Desenvolvedora Backend",
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
      { id: "c1", title: "Node Avancado", institution: "Escola", period: "2025", workload: "120h", description: "Node.js e APIs REST." },
      { id: "c2", title: "Docker", institution: "Academia", period: "2024", workload: "40h", description: "" },
    ],
    certifications: [{ id: "cert1", title: "PostgreSQL Professional", issuer: "Postgres", period: "2025", workload: "80h", credentialUrl: "https://example.com/cert" }],
    educations: [{ title: "ADS", institution: "Universidade", period: "2024 - 2027" }],
    experiences: [{ role: "Desenvolvedora", company: "Empresa", period: "2023 - atual", description: "Atividade integral cadastrada pelo usuario." }],
    languages: [{ name: "Ingles", level: "Intermediario - B1" }],
  };
  const match = {
    targetTitle: "Backend",
    jobKeywords: ["nodejs", "postgresql", "api-rest"],
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

  it("preserva secoes fixas e adapta skills, projetos e certificacoes/cursos", () => {
    const resume = compileResume({ profile, matchResult: match });
    expect(resume.header.title).toBe(profile.title);
    expect(resume.header.objective).toBe(profile.objective);
    expect(resume.header.cep).toBe(profile.cep);
    expect(resume.summary).toBe(profile.summary);
    expect(resume.education).toEqual(profile.educations);
    expect(resume.experiences[0].description).toBe(profile.experiences[0].description);
    expect(resume.courses.map((item) => item.id)).toEqual(["c1"]);
    expect(resume.certifications.map((item) => item.id)).toEqual(["cert1"]);
    expect(resume.languagesInline).toBe("Ingles - Intermediario - B1");
    expect(resume.skillsInline).toContain("Node.js");
    expect(resume.skillsInline).toContain("PostgreSQL");
    expect(resume.skillsInline).not.toContain("Backend:");
    expect(resume.skillsInline).not.toContain("Praticas/Versionamento:");
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
