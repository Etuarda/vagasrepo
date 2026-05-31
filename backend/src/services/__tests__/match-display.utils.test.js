// Tests for normalizeSharedMatchDisplay and normalizeHistoryItemDisplay.
// Functions are inlined here (pure logic, no dependencies) because the
// frontend uses ES modules while the backend test runner uses CommonJS.
// If the logic changes in frontend/src/js/match-display.utils.js, update here too.

const MAX_CARD_WARNINGS = 2;

function isMatchComplete(match) {
  return (
    match != null &&
    match.analysisStatus === "complete" &&
    match.scoreAvailable !== false &&
    match.score != null &&
    match.overallScore != null
  );
}

function scoreNum(match) {
  return Number(match.overallScore ?? match.score ?? 0);
}

function limitWarnings(warnings) {
  const all = (warnings || []).filter(Boolean);
  return {
    visibleWarnings: all.slice(0, MAX_CARD_WARNINGS),
    hiddenWarningsCount: Math.max(0, all.length - MAX_CARD_WARNINGS),
  };
}

function normalizeSharedMatchDisplay(job) {
  const match = job.profileMatch || {};
  const global = job.globalMatch || {};
  const best = job.bestSubprofileMatch || null;

  const isComplete = isMatchComplete(match);
  const canShowScore = isComplete;
  const scoreLabel = canShowScore ? `${scoreNum(match)}%` : "Análise incompleta";

  const globalComplete = isMatchComplete(global);
  const globalScoreLabel = globalComplete
    ? `Perfil Global: ${scoreNum(global)}%`
    : "Perfil Global: não calculado";

  let bestSubprofileLabel = null;
  if (best) {
    const bestName = best.profileName || "Subperfil";
    bestSubprofileLabel = isMatchComplete(best)
      ? `Melhor subperfil: ${bestName} — ${scoreNum(best)}%`
      : `Melhor subperfil: ${bestName} — não calculado`;
  }

  const gaps = (match.missingSkills || []).filter(Boolean).slice(0, 3);
  const { visibleWarnings, hiddenWarningsCount } = limitWarnings(match.warnings);

  return {
    isComplete,
    canShowScore,
    scoreLabel,
    globalScoreLabel,
    bestSubprofileLabel,
    matchedSkillsLabel: canShowScore
      ? `${Number(match.matchedSkillsCount || 0)} de ${Number(match.requiredSkillsCount || 0)}`
      : "não calculado",
    gapsLabel: canShowScore ? (gaps.length ? gaps.join(", ") : "nenhum") : "não calculado",
    projectsLabel: canShowScore ? String(Number(match.matchedProjectsCount || 0)) : "—",
    coursesCertificationsLabel: canShowScore ? String(Number(match.relevantLearningCount || 0)) : "—",
    visibleWarnings,
    hiddenWarningsCount,
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
    scoreLabel: isComplete ? `${Number(score)}%` : "Análise incompleta",
    globalScoreLabel: globalComplete ? `${Number(item.globalScore)}%` : "não calculado",
    selectedProfileLabel: isComplete
      ? `${Number(item.selectedProfileScore ?? score ?? 0)}%`
      : "não calculado",
    skillsLabel: isComplete ? `${(item.matchedSkills || []).length}` : "não calculado",
    gapsLabel: isComplete ? (gaps.length ? gaps.join(", ") : "nenhum") : "não calculado",
    projectsCount: isComplete ? (item.selectedProjectIds || []).length : "—",
    courseCount: isComplete ? courseCount : "—",
    visibleWarnings,
    hiddenWarningsCount,
  };
}

// ---------------------------------------------------------------------------

const completeMatch = {
  analysisStatus: "complete",
  scoreAvailable: true,
  score: 78,
  overallScore: 78,
  matchedSkillsCount: 6,
  requiredSkillsCount: 9,
  missingSkills: ["Redis", "CI/CD", "Kubernetes"],
  matchedProjectsCount: 2,
  relevantLearningCount: 3,
  warnings: [],
  profileName: "Backend",
};

const incompleteMatch = {
  analysisStatus: "incomplete",
  scoreAvailable: false,
  score: 0,
  overallScore: 0,
  warnings: ["Perfil incompleto: adicione learnedSkills nos projetos"],
};

const noScoreMatch = {
  analysisStatus: "complete",
  scoreAvailable: false,
  score: null,
  overallScore: null,
  warnings: [],
};

describe("normalizeSharedMatchDisplay", () => {
  it("analise completa exibe percentual e nao exibe 0% por padrao", () => {
    const result = normalizeSharedMatchDisplay({
      profileMatch: completeMatch,
      globalMatch: { ...completeMatch, overallScore: 61, score: 61 },
    });
    expect(result.isComplete).toBe(true);
    expect(result.canShowScore).toBe(true);
    expect(result.scoreLabel).toBe("78%");
  });

  it("analise incompleta nao exibe 0% — exibe texto de indisponivel", () => {
    const result = normalizeSharedMatchDisplay({
      profileMatch: incompleteMatch,
      globalMatch: incompleteMatch,
    });
    expect(result.isComplete).toBe(false);
    expect(result.canShowScore).toBe(false);
    expect(result.scoreLabel).toBe("Análise incompleta");
    expect(result.scoreLabel).not.toContain("0%");
  });

  it("score null mesmo com status complete nao exibe percentual", () => {
    const result = normalizeSharedMatchDisplay({ profileMatch: noScoreMatch });
    expect(result.canShowScore).toBe(false);
    expect(result.scoreLabel).toBe("Análise incompleta");
  });

  it("vaga sem subperfil retorna bestSubprofileLabel nulo", () => {
    const result = normalizeSharedMatchDisplay({
      profileMatch: completeMatch,
      globalMatch: { ...completeMatch, overallScore: 61, score: 61 },
      bestSubprofileMatch: null,
    });
    expect(result.bestSubprofileLabel).toBeNull();
  });

  it("vaga com subperfil exibe Global e Melhor subperfil", () => {
    const result = normalizeSharedMatchDisplay({
      profileMatch: completeMatch,
      globalMatch: { ...completeMatch, overallScore: 61, score: 61 },
      bestSubprofileMatch: {
        analysisStatus: "complete",
        scoreAvailable: true,
        score: 78,
        overallScore: 78,
        profileName: "Backend",
      },
    });
    expect(result.globalScoreLabel).toBe("Perfil Global: 61%");
    expect(result.bestSubprofileLabel).toBe("Melhor subperfil: Backend — 78%");
  });

  it("global incompleto exibe nao calculado", () => {
    const result = normalizeSharedMatchDisplay({
      profileMatch: completeMatch,
      globalMatch: incompleteMatch,
    });
    expect(result.globalScoreLabel).toBe("Perfil Global: não calculado");
  });

  it("skills e gaps nao calculados quando analise incompleta", () => {
    const result = normalizeSharedMatchDisplay({ profileMatch: incompleteMatch });
    expect(result.matchedSkillsLabel).toBe("não calculado");
    expect(result.gapsLabel).toBe("não calculado");
    expect(result.projectsLabel).toBe("—");
    expect(result.coursesCertificationsLabel).toBe("—");
  });

  it("skills e gaps corretos quando analise completa", () => {
    const result = normalizeSharedMatchDisplay({ profileMatch: completeMatch });
    expect(result.matchedSkillsLabel).toBe("6 de 9");
    expect(result.gapsLabel).toBe("Redis, CI/CD, Kubernetes");
    expect(result.projectsLabel).toBe("2");
    expect(result.coursesCertificationsLabel).toBe("3");
  });

  it("gapsLabel e nenhum quando nao ha gaps", () => {
    const result = normalizeSharedMatchDisplay({
      profileMatch: { ...completeMatch, missingSkills: [] },
    });
    expect(result.gapsLabel).toBe("nenhum");
  });

  it("warnings sao limitados a 2 no card", () => {
    const manyWarnings = {
      ...completeMatch,
      warnings: ["w1", "w2", "w3", "w4"],
    };
    const result = normalizeSharedMatchDisplay({ profileMatch: manyWarnings });
    expect(result.visibleWarnings).toHaveLength(2);
    expect(result.hiddenWarningsCount).toBe(2);
  });

  it("warnings zerados quando nao ha extras", () => {
    const result = normalizeSharedMatchDisplay({
      profileMatch: { ...completeMatch, warnings: ["w1"] },
    });
    expect(result.visibleWarnings).toHaveLength(1);
    expect(result.hiddenWarningsCount).toBe(0);
  });

  it("warnings vazios nao geram erros", () => {
    const result = normalizeSharedMatchDisplay({ profileMatch: completeMatch });
    expect(result.visibleWarnings).toHaveLength(0);
    expect(result.hiddenWarningsCount).toBe(0);
  });
});

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
    expect(result.scoreLabel).toBe("Análise incompleta");
    expect(result.scoreLabel).not.toContain("0%");
  });

  it("score null nao exibe percentual", () => {
    const result = normalizeHistoryItemDisplay({
      ...completeItem,
      overallScore: null,
      score: null,
    });
    expect(result.isComplete).toBe(false);
    expect(result.scoreLabel).toBe("Análise incompleta");
  });

  it("skills e cursos retornam nao calculado quando incompleto", () => {
    const result = normalizeHistoryItemDisplay({
      ...completeItem,
      analysisStatus: "incomplete",
      scoreAvailable: false,
    });
    expect(result.skillsLabel).toBe("não calculado");
    expect(result.gapsLabel).toBe("não calculado");
    expect(result.projectsCount).toBe("—");
    expect(result.courseCount).toBe("—");
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
