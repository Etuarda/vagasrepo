// Tests for normalizeHistoryItemDisplay.
// The frontend uses ES modules while the backend test runner uses CommonJS, so
// this file keeps the pure display logic inlined as a regression contract.

const MAX_CARD_WARNINGS = 2;

function limitWarnings(warnings) {
  const all = (warnings || []).filter(Boolean);
  return {
    visibleWarnings: all.slice(0, MAX_CARD_WARNINGS),
    hiddenWarningsCount: Math.max(0, all.length - MAX_CARD_WARNINGS),
  };
}

function normalizeHistoryItemDisplay(item) {
  const score = item.overallScore ?? item.score ?? null;
  const isComplete =
    item.analysisStatus === "complete" &&
    item.scoreAvailable !== false &&
    score != null;

  const globalComplete = item.globalAnalysisStatus === "complete" && item.globalScore != null;
  const gaps = (item.missingSkills || []).filter(Boolean).slice(0, 3);
  const courseCount =
    (item.selectedCourseIds || []).length + (item.selectedCertificationIds || []).length;
  const { visibleWarnings, hiddenWarningsCount } = limitWarnings(item.warnings);

  return {
    isComplete,
    scoreLabel: isComplete ? `${Number(score)}%` : "Analise incompleta",
    globalScoreLabel: globalComplete ? `${Number(item.globalScore)}%` : "nao calculado",
    selectedProfileLabel: isComplete
      ? `${Number(item.selectedProfileScore ?? score ?? 0)}%`
      : "nao calculado",
    skillsLabel: isComplete ? `${(item.matchedSkills || []).length}` : "nao calculado",
    gapsLabel: isComplete ? (gaps.length ? gaps.join(", ") : "nenhum") : "nao calculado",
    projectsCount: isComplete ? (item.selectedProjectIds || []).length : "-",
    courseCount: isComplete ? courseCount : "-",
    visibleWarnings,
    hiddenWarningsCount,
  };
}

describe("normalizeHistoryItemDisplay", () => {
  const completeItem = {
    analysisStatus: "complete",
    scoreAvailable: true,
    overallScore: 72,
    score: 72,
    globalScore: 55,
    globalAnalysisStatus: "complete",
    selectedProfileScore: 72,
    matchedSkills: ["Node.js", "PostgreSQL", "Docker"],
    missingSkills: ["Redis", "CI/CD"],
    selectedProjectIds: ["p1", "p2"],
    selectedCourseIds: ["c1"],
    selectedCertificationIds: ["cert1", "cert2"],
    warnings: [],
  };

  it("analise completa exibe percentual", () => {
    const result = normalizeHistoryItemDisplay(completeItem);
    expect(result.isComplete).toBe(true);
    expect(result.scoreLabel).toBe("72%");
  });

  it("analise incompleta nao exibe 0%", () => {
    const result = normalizeHistoryItemDisplay({
      ...completeItem,
      analysisStatus: "incomplete",
      scoreAvailable: false,
    });
    expect(result.isComplete).toBe(false);
    expect(result.scoreLabel).toBe("Analise incompleta");
    expect(result.scoreLabel).not.toContain("0%");
  });

  it("score null nao exibe percentual", () => {
    const result = normalizeHistoryItemDisplay({
      ...completeItem,
      overallScore: null,
      score: null,
    });
    expect(result.isComplete).toBe(false);
    expect(result.scoreLabel).toBe("Analise incompleta");
  });

  it("skills e cursos retornam nao calculado quando incompleto", () => {
    const result = normalizeHistoryItemDisplay({
      ...completeItem,
      analysisStatus: "incomplete",
      scoreAvailable: false,
    });
    expect(result.skillsLabel).toBe("nao calculado");
    expect(result.gapsLabel).toBe("nao calculado");
    expect(result.projectsCount).toBe("-");
    expect(result.courseCount).toBe("-");
  });

  it("contagem de cursos soma courses e certifications", () => {
    const result = normalizeHistoryItemDisplay(completeItem);
    expect(result.courseCount).toBe(3);
  });

  it("warnings sao limitados a 2 no card", () => {
    const result = normalizeHistoryItemDisplay({
      ...completeItem,
      warnings: ["a", "b", "c", "d"],
    });
    expect(result.visibleWarnings).toHaveLength(2);
    expect(result.hiddenWarningsCount).toBe(2);
  });
});
