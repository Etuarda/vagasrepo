jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("../profile.service", () => ({}));
jest.mock("../pdf-output.service", () => ({ generateOptimizedResumePdf: jest.fn() }));

const { analyzeProfile } = require("../matching.service");

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
});
