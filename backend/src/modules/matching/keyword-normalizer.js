const { TECH_ALIASES, CATEGORY_KEYWORDS, TRANSVERSAL_SKILLS } = require("../../shared/constants/tech-dictionary");

function stripDiacritics(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function basicNormalize(value) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/[^\w\s./+#-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactNormalize(value) {
  return basicNormalize(value).replace(/[\s._/+#-]+/g, "");
}

function aliasVariants(value) {
  const basic = basicNormalize(value);
  const words = basic.replace(/[._/+#-]+/g, " ").split(/\s+/).filter(Boolean);
  const variants = new Set([basic, compactNormalize(value)]);
  if (words.length > 1) {
    [" ", "-", ".", "_", "/", ""].forEach((separator) => variants.add(words.join(separator)));
  }
  return [...variants].filter(Boolean);
}

function technicalAliasEntries() {
  const entries = new Map();
  Object.entries(TECH_ALIASES).forEach(([canonical, aliases]) => {
    [canonical, ...aliases].flatMap(aliasVariants).forEach((alias) => {
      entries.set(`${canonical}:${alias}`, { canonical, alias });
    });
  });
  return [...entries.values()];
}

function normalizeTerm(value) {
  const input = basicNormalize(value);
  const compactInput = compactNormalize(value);
  for (const [canonical, aliases] of Object.entries(TECH_ALIASES)) {
    const variants = [canonical, ...aliases].flatMap(aliasVariants);
    if (variants.some((alias) => input === alias || compactInput === compactNormalize(alias))) return canonical;
  }
  return input.replace(/\s+/g, "-");
}

function normalizeText(value) {
  let output = ` ${basicNormalize(value)} `;
  const aliases = technicalAliasEntries();

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
  return [...new Set([...Object.values(CATEGORY_KEYWORDS).flat(), ...(TRANSVERSAL_SKILLS || [])])];
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
