export const MAX_CARD_WARNINGS = 2;

function limitWarnings(warnings) {
  const all = (warnings || []).filter(Boolean);
  return {
    visibleWarnings: all.slice(0, MAX_CARD_WARNINGS),
    hiddenWarningsCount: Math.max(0, all.length - MAX_CARD_WARNINGS),
  };
}

export function normalizeHistoryItemDisplay(item) {
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
