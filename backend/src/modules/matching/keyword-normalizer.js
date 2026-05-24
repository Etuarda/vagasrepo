const { TECH_ALIASES, CATEGORY_KEYWORDS } = require("../../shared/constants/tech-dictionary");

function stripDiacritics(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function basicNormalize(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[^\w\s./+#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTerm(value) {
  const input = basicNormalize(value);
  for (const [canonical, aliases] of Object.entries(TECH_ALIASES)) {
    if (aliases.some((alias) => input === basicNormalize(alias))) return canonical;
  }
  return input.replace(/\s+/g, "-");
}

function normalizeText(value) {
  let output = ` ${basicNormalize(value)} `;
  const aliases = Object.entries(TECH_ALIASES).flatMap(([canonical, values]) =>
    values.map((alias) => ({ canonical, alias: basicNormalize(alias) }))
  );

  aliases.sort((a, b) => b.alias.length - a.alias.length).forEach(({ canonical, alias }) => {
    const expression = new RegExp(`(^|\\s)${escapeRegExp(alias)}(?=\\s|[.,;/]|$)`, "g");
    output = output.replace(expression, `$1${canonical}`);
  });

  return output.replace(/[.,;/](?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function vocabulary() {
  return [...new Set(Object.values(CATEGORY_KEYWORDS).flat())];
}

function extractTechnicalKeywords(value) {
  const text = ` ${normalizeText(value)} `;
  return vocabulary().filter((keyword) => {
    const term = normalizeTerm(keyword);
    return text.includes(` ${term} `) || text.includes(` ${term}-`) || text.includes(`-${term} `);
  });
}

function classifyJob(value) {
  const keywords = extractTechnicalKeywords(value);
  const scores = Object.entries(CATEGORY_KEYWORDS).map(([category, terms]) => ({
    category,
    score: terms.reduce((sum, term) => sum + (keywords.includes(normalizeTerm(term)) ? 1 : 0), 0),
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.score ? { category: scores[0].category, scores, keywords } : { category: "unknown", scores, keywords };
}

module.exports = { normalizeTerm, normalizeText, extractTechnicalKeywords, classifyJob };
