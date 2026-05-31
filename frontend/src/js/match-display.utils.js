export const MAX_CARD_WARNINGS = 2;

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

export function normalizeSharedMatchDisplay(job) {
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
