const { compressResume, RESUME_LAYOUT_RULES } = require("../../modules/resume/resume-layout.service");

describe("resume layout", () => {
  it("preserva conteudo fixo e limita somente selecao de projetos e bullets", () => {
    const summary = "x".repeat(700);
    const experienceDescription = "atividade ".repeat(120);
    const compact = compressResume({
      summary,
      skillsInline: "Node.js, ".repeat(80),
      courses: [{ title: "Curso completo" }],
      certifications: [{ title: "Certificacao completa" }],
      experiences: [{ description: experienceDescription }],
      projects: [{ bullets: ["1", "2", "3", "4"] }, { bullets: [] }, { bullets: [] }],
    });
    expect(RESUME_LAYOUT_RULES.maxPages).toBe(2);
    expect(RESUME_LAYOUT_RULES.bodyFontSize).toBe(11);
    expect(RESUME_LAYOUT_RULES.titleFontSize).toBe(23);
    expect(compact.summary).toBe(summary);
    expect(compact.experiences[0].description).toBe(experienceDescription);
    expect(compact.courses).toHaveLength(1);
    expect(compact.certifications).toHaveLength(1);
    expect(compact.projects).toHaveLength(2);
    expect(compact.projects[0].bullets).toHaveLength(3);
  });
});
