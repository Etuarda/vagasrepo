const { skillsSchema, projectSchema, subprofileAllocationSchema } = require("../../schemas/profile.schema");

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
  it("aceita stack textual cadastrada para um projeto", () => {
    const payload = projectSchema.parse({
      title: "API",
      category: "backend",
      shortDescription: "Servico de assinaturas.",
      stack: "Node.js, TypeScript, PostgreSQL",
      repositoryUrl: "",
      deployUrl: "",
    });
    expect(payload.stack).toBe("Node.js, TypeScript, PostgreSQL");
  });

  it("valida a alocacao selecionada para um subperfil", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const payload = subprofileAllocationSchema.parse({ profileId: id, projectIds: [id] });
    expect(payload.projectIds).toEqual([id]);
    expect(payload.educationIds).toEqual([]);
  });
});
