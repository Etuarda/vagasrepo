const { compressResume, RESUME_LAYOUT_RULES } = require("../../modules/resume/resume-layout.service");

describe("resume layout", () => {
  it("aplica limites globais de espaco", () => {
    const compact = compressResume({
      summary: "x".repeat(700),
      skillsInline: "Node.js, ".repeat(80),
      coursesAndCertificationsInline: "Curso; ".repeat(80),
      experiences: [{ bullets: ["a", "b", "c"] }],
      projects: [{ bullets: ["1", "2", "3", "4"] }, { bullets: [] }, { bullets: [] }],
    });
    expect(compact.summary.length).toBeLessThanOrEqual(RESUME_LAYOUT_RULES.maxSummaryChars);
    expect(compact.projects).toHaveLength(2);
    expect(compact.projects[0].bullets).toHaveLength(3);
    expect(compact.experiences[0].bullets).toHaveLength(2);
    expect(compact.layout.skillLines).toBeLessThanOrEqual(2);
    expect(compact.layout.coursesAndCertificationsLines).toBeLessThanOrEqual(2);
  });
});
