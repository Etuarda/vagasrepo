const { skillsSchema } = require("../../schemas/profile.schema");

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
