const { normalizeTerm, normalizeText } = require("./keyword-normalizer");

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function termMatches(text, keyword) {
  return ` ${normalizeText(text)} `.includes(` ${normalizeTerm(keyword)} `);
}

function scoreProject(project, jobKeywords) {
  const learnedSkills = project.learnedSkills || [];
  if (!learnedSkills.length) {
    return { skillMatches: [], evidenceMatches: [], score: 0 };
  }
  const skillSource = learnedSkills.join(" ");
  const descriptionSource = [project.shortDescription, project.description, project.technicalSolution].join(" ");
  const categorySource = [project.category, project.stack].join(" ");
  const skillMatches = unique(jobKeywords.filter((keyword) => termMatches(skillSource, keyword)));
  const descriptionMatches = unique(jobKeywords.filter((keyword) => termMatches(descriptionSource, keyword)));
  const categoryMatches = unique(jobKeywords.filter((keyword) => termMatches(categorySource, keyword)));
  const evidenceMatches = unique([...descriptionMatches, ...categoryMatches]);
  const hasDescription = String(project.shortDescription || "").trim().length >= 10;
  const hasRepository = Boolean(String(project.repositoryUrl || "").trim());
  const hasDeploy = Boolean(String(project.deployUrl || "").trim());
  const skillScore = Math.min(100, scoreRatio(skillMatches.length, jobKeywords.length));
  const descriptionScore = Math.min(100, scoreRatio(descriptionMatches.length, jobKeywords.length) + (hasDescription ? 20 : 0));
  const categoryScore = Math.min(100, scoreRatio(categoryMatches.length, jobKeywords.length));
  return {
    skillMatches,
    evidenceMatches,
    score: Math.round(
      skillScore * 0.45 +
      descriptionScore * 0.20 +
      (hasRepository ? 100 : 0) * 0.15 +
      (hasDeploy ? 100 : 0) * 0.10 +
      categoryScore * 0.10
    ),
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
