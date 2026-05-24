const { normalizeTerm, normalizeText } = require("./keyword-normalizer");

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function termMatches(text, keyword) {
  return ` ${normalizeText(text)} `.includes(` ${normalizeTerm(keyword)} `);
}

function selectBullets(project, jobKeywords, limit = 3) {
  const usedEvidence = new Set();
  return (project.bullets || [])
    .filter((bullet) => bullet.isActive !== false && bullet.content)
    .map((bullet) => {
      const matches = unique(jobKeywords.filter((keyword) =>
        termMatches(`${bullet.content} ${(bullet.keywords || []).join(" ")}`, keyword)
      ));
      return { ...bullet, matches, score: matches.length * 20 + Number(bullet.weight || 0) };
    })
    .sort((a, b) => b.score - a.score)
    .filter((bullet) => {
      const newEvidence = bullet.matches.some((term) => !usedEvidence.has(term));
      if (!newEvidence && usedEvidence.size && bullet.score < 70) return false;
      bullet.matches.forEach((term) => usedEvidence.add(term));
      return true;
    })
    .slice(0, limit);
}

function rankProjects(projects, jobKeywords, limit = 2) {
  return (projects || [])
    .filter((project) => project.isVisible !== false)
    .map((project) => {
      const source = [
        project.title,
        project.category,
        project.shortDescription,
        project.description,
        project.technicalSolution,
        project.architecture,
        ...(project.technologies || []),
      ].join(" ");
      const matches = unique(jobKeywords.filter((keyword) => termMatches(source, keyword)));
      const selectedBullets = selectBullets(project, jobKeywords);
      const weight = Number(project.relevanceWeight || 50);
      const score = Math.min(100, Math.round(matches.length * 18 + selectedBullets.length * 6 + weight * 0.25));
      const reasonTerms = matches.slice(0, 5).join(", ");
      return {
        ...project,
        score,
        matchedKeywords: matches,
        selectedBullets,
        reason: reasonTerms
          ? `Selecionado por evidencias cadastradas em ${reasonTerms}.`
          : "Selecionado por prioridade configurada no subperfil.",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = { rankProjects, selectBullets };
