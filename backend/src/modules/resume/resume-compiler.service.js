const { TRANSVERSAL_SKILLS } = require("../../shared/constants/tech-dictionary");
const { normalizeTerm, normalizeText } = require("../matching/keyword-normalizer");
const { compressResume, RESUME_LAYOUT_RULES } = require("./resume-layout.service");

function uniqueByNormalized(values) {
  const found = new Set();
  return (values || []).filter((value) => {
    const key = normalizeTerm(typeof value === "string" ? value : value.name);
    if (!key || found.has(key)) return false;
    found.add(key);
    return true;
  });
}

function compileSkills(profile, matchResult, rules) {
  const catalog = new Map((profile.skillItems || (profile.skills || []).map((name) => ({ name, category: "other" })))
    .map((skill) => [normalizeTerm(skill.name), skill]));
  const matched = (matchResult.matchedSkills || []).map((name) => catalog.get(normalizeTerm(name))).filter(Boolean);
  const transversal = [...catalog.values()].filter((skill) =>
    TRANSVERSAL_SKILLS.includes(normalizeTerm(skill.name)) &&
    (matchResult.jobKeywords || []).map(normalizeTerm).includes(normalizeTerm(skill.name))
  );
  const targeted = matched.length || (matchResult.jobKeywords || []).length ? matched : [...catalog.values()];
  const ordered = uniqueByNormalized([...targeted, ...transversal]);
  return ordered.map((skill) => skill.name).join(", ");
}

function parseHours(value) {
  const matches = String(value || "").match(/\d+/g);
  return matches ? Math.max(...matches.map(Number)) : 0;
}

function parseMostRecentYear(value) {
  const years = String(value || "").match(/\b(19|20)\d{2}\b/g);
  return years ? Math.max(...years.map(Number)) : 0;
}

function evidenceMatches(item, keywords) {
  const source = [item.title, item.issuer, item.institution, item.description].join(" ");
  const normalizedSource = ` ${normalizeText(source)} `;
  return uniqueByNormalized((keywords || []).filter((keyword) => normalizedSource.includes(` ${normalizeTerm(keyword)} `)));
}

function rankLearningItems({ courses = [], certifications = [] }, matchResult, limit = 5) {
  const keywords = matchResult.jobKeywords || [];
  return [
    ...certifications.map((item) => ({ ...item, itemType: "certification" })),
    ...courses.map((item) => ({ ...item, itemType: "course" })),
  ].map((item) => {
    const matchedKeywords = evidenceMatches(item, keywords);
    const hours = parseHours(item.workload);
    const year = parseMostRecentYear(item.period);
    const certificationBonus = item.itemType === "certification" ? 28 : 0;
    const shortCoursePenalty = item.itemType === "course" && hours > 0 && hours < 100 ? -14 : 0;
    const score = matchedKeywords.length * 40 +
      Math.min(hours, 400) / 10 +
      (year ? Math.min(20, Math.max(0, year - 2018) * 2) : 0) +
      certificationBonus +
      shortCoursePenalty;
    return { ...item, matchedKeywords, score };
  })
    .filter((item) => item.matchedKeywords.length)
    .sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length || b.score - a.score)
    .slice(0, limit);
}

function compileResume({ profile, matchResult, rules = RESUME_LAYOUT_RULES }) {
  const projects = (matchResult.selectedProjects || []).map((project) => ({
    id: project.id,
    title: project.customTitle || project.title,
    category: project.category || "",
    repositoryUrl: project.repositoryUrl,
    deployUrl: project.deployUrl,
    summary: project.shortDescription || "",
  }));

  return compressResume({
    header: {
      name: profile.name,
      title: profile.title || "",
      objective: profile.objective || "",
      location: profile.location || "",
      cep: profile.cep || "",
      email: profile.emailContact || "",
      phone: profile.phone || "",
      linkedin: profile.linkedin || "",
      github: profile.github || "",
      lattes: profile.lattes || "",
    },
    summary: profile.summary || "",
    education: profile.educations || [],
    skillsInline: compileSkills(profile, matchResult, rules),
    experiences: (profile.experiences || []).map((experience) => ({
      title: `${experience.role} | ${experience.company}`,
      period: experience.period,
      workload: experience.workload || "",
      description: experience.description || "",
    })),
    projects,
    courses: rankLearningItems(profile, matchResult).filter((item) => item.itemType === "course"),
    certifications: rankLearningItems(profile, matchResult).filter((item) => item.itemType === "certification"),
    languagesInline: (profile.languages || []).map((item) => [item.name, item.level].filter(Boolean).join(" - ")).join("; "),
  }, rules);
}

module.exports = { compileResume, compileSkills, uniqueByNormalized, rankLearningItems, parseHours, parseMostRecentYear };
