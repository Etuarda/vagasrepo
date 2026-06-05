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
    educations: [{ title: "ADS", institution: "Universidade", period: "2024 - 2027", learnedSkills: ["SQL"] }],
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
    expect(resume.header).not.toHaveProperty("title");
    expect(resume.header.objective).toBe(profile.objective);
    expect(resume.header.cep).toBe(profile.cep);
    expect(resume.summary).toBe(profile.summary);
    expect(resume.education).toEqual([{ title: "ADS", institution: "Universidade", period: "2024 - 2027" }]);
    expect(resume.experiences[0].description).toBe(profile.experiences[0].description);
    expect(resume.courses.map((item) => item.id)).toEqual(["c1", "c2"]);
    expect(resume.certifications.map((item) => item.id)).toEqual(["cert1"]);
    expect(resume.languagesInline).toBe("Ingles - Intermediario - B1");
    expect(resume.skillsInline).toContain("Node.js");
    expect(resume.skillsInline).toContain("PostgreSQL");
    expect(resume.skillsInline).not.toContain("Backend:");
    expect(resume.skillsInline).not.toContain("Praticas/Versionamento:");
    expect(resume.projects[0].summary).toBe("Resumo curto exatamente cadastrado pelo usuario.");
    expect(resume.projects[0]).not.toHaveProperty("stack");
    expect(resume.projects[0]).not.toHaveProperty("bullets");
    expect(resume.education[0]).not.toHaveProperty("learnedSkills");
    expect(resume.experiences[0]).not.toHaveProperty("learnedSkills");
    expect(resume.courses[0]).not.toHaveProperty("learnedSkills");
    expect(resume.certifications[0]).not.toHaveProperty("learnedSkills");
  });

  it("nao usa descricao legada como resumo de projeto", () => {
    const resume = compileResume({
      profile,
      matchResult: { ...match, selectedProjects: [{ id: "legacy", title: "Legado", description: "API cadastrada anteriormente." }] },
    });
    expect(resume.projects[0].summary).toBe("");
  });

  it("inclui cursos sem match de keywords quando includeUnmatched ativo", () => {
    const { rankLearningItems } = require("../../modules/resume/resume-compiler.service");
    const profileWithCourses = {
      courses: [
        { id: "c-nomatch", title: "Design Visual", institution: "Escola", period: "2024", workload: "80h", learnedSkills: ["Figma"] },
        { id: "c-match", title: "Node Avancado", institution: "Escola", period: "2025", workload: "120h", learnedSkills: ["Node.js"] },
      ],
      certifications: [],
    };
    const withoutUnmatched = rankLearningItems(profileWithCourses, { jobKeywords: ["nodejs"] }, 5);
    const withUnmatched = rankLearningItems(profileWithCourses, { jobKeywords: ["nodejs"] }, 5, { includeUnmatched: true });

    expect(withoutUnmatched.map((item) => item.id)).toEqual(["c-match"]);
    expect(withUnmatched.map((item) => item.id)).toEqual(["c-match", "c-nomatch"]);
  });

  it("ranking mantém certificações acima de cursos de mesma relevância", () => {
    const { rankLearningItems } = require("../../modules/resume/resume-compiler.service");
    const items = {
      courses: [{ id: "c1", title: "Node.js Basico", period: "2025", workload: "120h", learnedSkills: ["Node.js"] }],
      certifications: [{ id: "cert1", title: "Node.js Professional", period: "2025", workload: "80h", learnedSkills: ["Node.js"] }],
    };
    const ranked = rankLearningItems(items, { jobKeywords: ["nodejs"] }, 5);
    expect(ranked[0].id).toBe("cert1");
    expect(ranked[0].itemType).toBe("certification");
  });

  it("penaliza curso abaixo de 100h na pontuacao", () => {
    const { rankLearningItems } = require("../../modules/resume/resume-compiler.service");
    const items = {
      courses: [
        { id: "short", title: "Node.js Rapido", period: "2025", workload: "40h", learnedSkills: ["Node.js"] },
        { id: "long", title: "Node.js Completo", period: "2025", workload: "120h", learnedSkills: ["Node.js"] },
      ],
      certifications: [],
    };
    const ranked = rankLearningItems(items, { jobKeywords: ["nodejs"] }, 5);
    const shortScore = ranked.find((item) => item.id === "short").score;
    const longScore = ranked.find((item) => item.id === "long").score;
    expect(longScore).toBeGreaterThan(shortScore);
    expect(ranked[0].id).toBe("long");
  });

  it("compileResume nao inclui campo title no header", () => {
    const resume = compileResume({ profile, matchResult: match });
    expect(resume.header.title).toBeUndefined();
    expect(resume.header.objective).toBe("Desenvolvedora Backend");
  });

  it("mantem a ordem estrutural do curriculo otimizado", () => {
    const resume = compileResume({ profile, matchResult: match });
    const keys = Object.keys(resume);
    expect(keys.indexOf("header")).toBeLessThan(keys.indexOf("summary"));
    expect(keys.indexOf("summary")).toBeLessThan(keys.indexOf("education"));
    expect(keys.indexOf("education")).toBeLessThan(keys.indexOf("experiences"));
    expect(keys.indexOf("experiences")).toBeLessThan(keys.indexOf("projects"));
    expect(keys.indexOf("projects")).toBeLessThan(keys.indexOf("skillsInline"));
    expect(keys.indexOf("skillsInline")).toBeLessThan(keys.indexOf("courses"));
    expect(keys.indexOf("courses")).toBeLessThan(keys.indexOf("languagesInline"));
  });

  it("completa o curriculo com ate 2 projetos usando projetos cadastrados no perfil", () => {
    const resume = compileResume({
      profile: {
        ...profile,
        projects: [
          { id: "p1", title: "API", shortDescription: "Resumo do projeto selecionado." },
          { id: "p2", title: "Dashboard", shortDescription: "Resumo do segundo projeto cadastrado." },
          { id: "p3", title: "CLI", shortDescription: "Resumo do terceiro projeto cadastrado." },
        ],
      },
      matchResult: {
        ...match,
        selectedProjects: [{ id: "p1", title: "API", shortDescription: "Resumo do projeto selecionado." }],
      },
    });

    expect(resume.projects.map((project) => project.id)).toEqual(["p1", "p2"]);
  });

  it("compileResume inclui cursos mesmo sem match perfeito com a vaga", () => {
    const profileWithUnmatchedCourse = {
      ...profile,
      courses: [
        { id: "unmatched", title: "Design UI", institution: "Escola", period: "2024", workload: "80h", learnedSkills: ["Figma"], description: "" },
      ],
      certifications: [],
    };
    const resume = compileResume({ profile: profileWithUnmatchedCourse, matchResult: { ...match, jobKeywords: ["nodejs"] } });
    expect(resume.courses.map((c) => c.id)).toContain("unmatched");
  });

  it("limita curriculo otimizado a 2 projetos, 5 cursos/certificacoes e 30 skills", () => {
    const manySkills = Array.from({ length: 40 }, (_, index) => ({ name: `Skill ${index + 1}`, category: "other" }));
    const manyProjects = Array.from({ length: 4 }, (_, index) => ({
      id: `p${index + 1}`,
      title: `Projeto ${index + 1}`,
      shortDescription: "Projeto cadastrado pelo usuario.",
    }));
    const manyCourses = Array.from({ length: 6 }, (_, index) => ({
      id: `c${index + 1}`,
      title: `Curso ${index + 1}`,
      period: "2025",
      workload: "120h",
      learnedSkills: [`Skill ${index + 1}`],
    }));
    const manyCertifications = Array.from({ length: 3 }, (_, index) => ({
      id: `cert${index + 1}`,
      title: `Certificacao ${index + 1}`,
      period: "2025",
      workload: "120h",
      learnedSkills: [`Skill ${index + 10}`],
    }));

    const resume = compileResume({
      profile: {
        ...profile,
        skillItems: manySkills,
        courses: manyCourses,
        certifications: manyCertifications,
      },
      matchResult: {
        ...match,
        matchedSkills: manySkills.map((skill) => skill.name),
        jobKeywords: manySkills.map((skill) => skill.name),
        selectedProjects: manyProjects,
      },
    });

    const skillCount = resume.skillsInline.split(",").map((item) => item.trim()).filter(Boolean).length;
    expect(resume.projects).toHaveLength(2);
    expect(resume.courses.length + resume.certifications.length).toBeLessThanOrEqual(5);
    expect(skillCount).toBeGreaterThanOrEqual(15);
    expect(skillCount).toBeLessThanOrEqual(30);
  });
});
