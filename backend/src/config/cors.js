function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HOSTED_FRONTEND_ORIGINS = Object.freeze([
  "https://gestaodevagas.vercel.app",
  "https://gestaodevagas-*-eduardas-projects-9a8623c8.vercel.app",
]);

function compileOriginPattern(value) {
  if (!value.includes("*")) return null;

  const candidate = value.replaceAll("*", "preview");
  const parsed = new URL(candidate);
  if (parsed.origin !== candidate || !value.startsWith("https://")) {
    throw new Error(`Padrao CORS invalido: ${value}`);
  }

  const expression = escapeRegExp(value).replaceAll("\\*", "[^./]+");
  return new RegExp(`^${expression}$`);
}

function createOriginMatcher(values) {
  const exact = new Set();
  const patterns = [];

  (values || []).forEach((value) => {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    const pattern = compileOriginPattern(normalized);
    if (pattern) patterns.push(pattern);
    else exact.add(normalized);
  });

  return (origin) => exact.has(origin) || patterns.some((pattern) => pattern.test(origin));
}

module.exports = { HOSTED_FRONTEND_ORIGINS, compileOriginPattern, createOriginMatcher };
