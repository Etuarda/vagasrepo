const { compressResume, RESUME_LAYOUT_RULES } = require("../../modules/resume/resume-layout.service");

describe("resume layout", () => {
  it("preserva conteudo fixo e limita selecoes para caber em duas paginas", () => {
    const summary = "x".repeat(700);
    const experienceDescription = "atividade ".repeat(120);
    const compact = compressResume({
      summary,
      skillsInline: "Node.js, ".repeat(80),
      courses: [
        { title: "Curso 1" },
        { title: "Curso 2" },
        { title: "Curso 3" },
        { title: "Curso 4" },
      ],
      certifications: [
        { title: "Certificacao 1" },
        { title: "Certificacao 2" },
        { title: "Certificacao 3" },
      ],
      experiences: [{ description: experienceDescription }],
      projects: [{ title: "A" }, { title: "B" }, { title: "C" }],
    });
    expect(RESUME_LAYOUT_RULES.maxPages).toBe(2);
    expect(RESUME_LAYOUT_RULES.maxProjects).toBe(2);
    expect(RESUME_LAYOUT_RULES.maxLearningItems).toBe(5);
    expect(RESUME_LAYOUT_RULES.minSkills).toBe(15);
    expect(RESUME_LAYOUT_RULES.maxSkills).toBe(30);
    expect(RESUME_LAYOUT_RULES.bodyFontSize).toBe(11);
    expect(RESUME_LAYOUT_RULES.titleFontSize).toBe(23);
    expect(compact.summary).toBe(summary);
    expect(compact.experiences[0].description).toBe(experienceDescription);
    expect(compact.courses.length + compact.certifications.length).toBe(5);
    expect(compact.projects).toHaveLength(2);
  });
});
