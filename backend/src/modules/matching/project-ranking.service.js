const { normalizeTerm, normalizeText } = require("./keyword-normalizer");

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function termMatches(text, keyword) {
  return ` ${normalizeText(text)} `.includes(` ${normalizeTerm(keyword)} `);
}

function rankProjects(projects, jobKeywords, limit = 2) {
  return (projects || [])
    .filter((project) => project.isVisible !== false)
    .map((project) => {
      const source = [
        project.title,
        project.category,
        project.shortDescription,
      ].join(" ");
      const matches = unique(jobKeywords.filter((keyword) => termMatches(source, keyword)));
      const weight = Number(project.relevanceWeight || 50);
      const score = Math.min(100, Math.round(matches.length * 22 + weight * 0.25));
      const reasonTerms = matches.slice(0, 5).join(", ");
      return {
        ...project,
        score,
        matchedKeywords: matches,
        reason: reasonTerms
          ? `Selecionado por evidencias cadastradas em ${reasonTerms}.`
          : "Selecionado por prioridade configurada no subperfil.",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { rankProjects };
