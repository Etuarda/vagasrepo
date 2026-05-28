const { normalizeTerm, normalizeText } = require("./keyword-normalizer");

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function termMatches(text, keyword) {
  return ` ${normalizeText(text)} `.includes(` ${normalizeTerm(keyword)} `);
}

function scoreProject(project, jobKeywords) {
  const skillSource = [
    project.title,
    project.category,
    project.stack,
    ...(project.learnedSkills || []),
  ].join(" ");
  const evidenceSource = [
    project.shortDescription,
    project.repositoryUrl,
    project.deployUrl,
  ].join(" ");
  const skillMatches = unique(jobKeywords.filter((keyword) => termMatches(skillSource, keyword)));
  const evidenceMatches = unique(jobKeywords.filter((keyword) => termMatches(evidenceSource, keyword)));
  const hasDescription = String(project.shortDescription || "").trim().length >= 10;
  const hasLink = Boolean(String(project.repositoryUrl || project.deployUrl || "").trim());
  const skillScore = Math.min(100, scoreRatio(skillMatches.length, jobKeywords.length));
  const evidenceScore = Math.min(100, scoreRatio(evidenceMatches.length, jobKeywords.length) * 0.7 + (hasDescription ? 15 : 0) + (hasLink ? 15 : 0));
  return {
    skillMatches,
    evidenceMatches,
    score: Math.round(skillScore * 0.5 + evidenceScore * 0.5),
  };
}

function scoreRatio(matched, total) {
  return total ? Math.round((matched / total) * 100) : 0;
}

function rankProjects(projects, jobKeywords, limit = 2) {
  return (projects || [])
    .filter((project) => project.isVisible !== false)
    .map((project) => {
      const scored = scoreProject(project, jobKeywords);
      const matches = unique([...scored.skillMatches, ...scored.evidenceMatches]);
      const weight = Number(project.relevanceWeight || 50);
      const score = Math.min(100, Math.round(scored.score * 0.85 + weight * 0.15));
      const reasonTerms = matches.slice(0, 5).join(", ");
      return {
        ...project,
        score,
        skillMatchScore: scoreRatio(scored.skillMatches.length, jobKeywords.length),
        evidenceMatchScore: scoreRatio(scored.evidenceMatches.length, jobKeywords.length),
        matchedKeywords: matches,
        reason: reasonTerms
          ? `Selecionado por skills, descricao e links aderentes a ${reasonTerms}.`
          : "Selecionado por prioridade configurada no subperfil.",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { rankProjects, scoreProject };
