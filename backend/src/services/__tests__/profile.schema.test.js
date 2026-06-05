const { skillsSchema, projectSchema, experienceSchema, subprofileAllocationSchema, matchSchema, sharedMatchedJobsQuerySchema } = require("../../schemas/profile.schema");

describe("profile skill input", () => {
  it("separa habilidades informadas em uma linha por virgulas", () => {
    const payload = skillsSchema.parse({ skills: ["Node.js, PostgreSQL, Docker"] });

    expect(payload.skills).toEqual(["Node.js", "PostgreSQL", "Docker"]);
  });

  it("preserva entradas ja enviadas como itens separados", () => {
    const payload = skillsSchema.parse({ skills: ["Node.js", "TypeScript"] });

    expect(payload.skills).toEqual(["Node.js", "TypeScript"]);
  });
});

describe("project and subprofile inputs", () => {
  it("aceita habilidades aprendidas para matching do projeto", () => {
    const payload = projectSchema.parse({
      title: "API",
      category: "backend",
      shortDescription: "Servico de assinaturas.",
      learnedSkills: "Node.js, TypeScript, PostgreSQL",
      repositoryUrl: "",
      deployUrl: "",
    });
    expect(payload.learnedSkills).toEqual(["Node.js", "TypeScript", "PostgreSQL"]);
  });

  it("nao limita a quantidade de habilidades aprendidas separadas por virgula", () => {
    const skills = Array.from({ length: 250 }, (_, index) => `Skill ${index + 1}`).join(", ");
    const payload = projectSchema.parse({
      title: "API",
      category: "backend",
      shortDescription: "Servico de assinaturas.",
      learnedSkills: skills,
      repositoryUrl: "",
      deployUrl: "",
    });

    expect(payload.learnedSkills).toHaveLength(250);
  });

  it("remove habilidades aprendidas do payload de experiencia", () => {
    const longSkill = `Arquitetura ${"distribuida ".repeat(80)}`.trim();
    const payload = experienceSchema.parse({
      company: "Empresa",
      role: "Backend",
      period: "2025",
      workload: "40h",
      description: "Atividades reais suficientemente detalhadas.",
      learnedSkills: `Node.js, ${longSkill}`,
    });

    expect(payload).not.toHaveProperty("learnedSkills");
  });

  it("valida a alocacao selecionada para um subperfil", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const payload = subprofileAllocationSchema.parse({ profileId: id, projectIds: [id] });
    expect(payload.projectIds).toEqual([id]);
    expect(payload.educationIds).toEqual([]);
  });
});

describe("shared matching job inputs", () => {
  const matchPayload = {
    jobTitle: "Backend Developer",
    company: "Empresa",
    linkVaga: "https://example.com/vaga",
    jobDescription: "Descricao de vaga com requisitos Node.js e PostgreSQL.",
  };

  it("exige cargo, empresa e link para gerar matching", () => {
    expect(matchSchema.parse(matchPayload)).toEqual(expect.objectContaining(matchPayload));
    expect(() => matchSchema.parse({ ...matchPayload, company: "" })).toThrow();
    expect(() => matchSchema.parse({ ...matchPayload, linkVaga: "" })).toThrow();
  });

  it("limita filtros publicos aos periodos suportados", () => {
    expect(sharedMatchedJobsQuerySchema.parse({}).period).toBe("month");
    expect(sharedMatchedJobsQuerySchema.parse({ period: "week" }).period).toBe("week");
    expect(() => sharedMatchedJobsQuerySchema.parse({ period: "all" })).toThrow();
  });
});
