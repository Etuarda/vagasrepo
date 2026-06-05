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
  const catalogItems = [
    ...(profile.skillItems || (profile.skills || []).map((name) => ({ name, category: "other" }))),
    ...collectLearnedSkillItems(profile),
  ];
  const catalog = new Map(catalogItems.map((skill) => [normalizeTerm(skill.name), skill]));
  const matched = (matchResult.matchedSkills || []).map((name) =>
    catalog.get(normalizeTerm(name)) || { name, category: "learned" }
  ).filter(Boolean);
  const transversal = [...catalog.values()].filter((skill) =>
    TRANSVERSAL_SKILLS.includes(normalizeTerm(skill.name)) &&
    (matchResult.jobKeywords || []).map(normalizeTerm).includes(normalizeTerm(skill.name))
  );
  const stackLabels = new Set(["backend", "frontend", "fullstack", "dados", "data", "cloud", "qa", "devops"]);
  const targeted = matched.length || (matchResult.jobKeywords || []).length ? matched : [...catalog.values()];
  const ordered = uniqueByNormalized([...targeted, ...transversal, ...catalog.values()])
    .filter((skill) => !stackLabels.has(normalizeTerm(skill.name)))
    .slice(0, rules.maxSkills);
  return ordered.map((skill) => skill.name).join(", ");
}

function collectLearnedSkillItems(profile) {
  return [
    ...(profile.projects || []),
    ...(profile.courses || []),
    ...(profile.certifications || []),
    ...(profile.educations || []),
  ].flatMap((item) => (item.learnedSkills || []).map((name) => ({ name, category: "learned" })));
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
  const source = [item.title, item.issuer, item.institution, item.description, ...(item.learnedSkills || [])].join(" ");
  const normalizedSource = ` ${normalizeText(source)} `;
  return uniqueByNormalized((keywords || []).filter((keyword) => normalizedSource.includes(` ${normalizeTerm(keyword)} `)));
}

function rankLearningItems({ courses = [], certifications = [] }, matchResult, limit = 5, { includeUnmatched = false } = {}) {
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
    .filter((item) => includeUnmatched || item.matchedKeywords.length)
    .sort((a, b) => b.matchedKeywords.length - a.matchedKeywords.length || b.score - a.score)
    .slice(0, limit);
}

const MIN_PROJECTS = RESUME_LAYOUT_RULES.maxProjects;
const MIN_LEARNING_ITEMS = RESUME_LAYOUT_RULES.maxLearningItems;
const MIN_SKILLS = RESUME_LAYOUT_RULES.minSkills;
const MAX_PROJECTS = RESUME_LAYOUT_RULES.maxProjects;
const MAX_SKILLS = RESUME_LAYOUT_RULES.maxSkills;
const MAX_LEARNING_ITEMS = RESUME_LAYOUT_RULES.maxLearningItems;

function toProjectShape(project) {
  return {
    id: project.id,
    title: project.customTitle || project.title,
    category: project.category || "",
    repositoryUrl: project.repositoryUrl,
    deployUrl: project.deployUrl,
    summary: project.shortDescription || "",
  };
}

function toEducationShape(education) {
  return {
    id: education.id,
    title: education.title,
    institution: education.institution || "",
    period: education.period || "",
  };
}

function toCourseShape(course) {
  return {
    id: course.id,
    title: course.title,
    institution: course.institution || "",
    period: course.period || "",
    workload: course.workload || "",
    description: course.description || "",
  };
}

function toCertificationShape(certification) {
  return {
    id: certification.id,
    title: certification.title,
    issuer: certification.issuer || "",
    period: certification.period || "",
    workload: certification.workload || "",
    credentialUrl: certification.credentialUrl || "",
  };
}

function compileResume({ profile, matchResult, rules = RESUME_LAYOUT_RULES }) {
  const projects = (matchResult.selectedProjects || []).map(toProjectShape).slice(0, rules.maxProjects);

  const learningItems = rankLearningItems(profile, matchResult, rules.maxLearningItems, { includeUnmatched: true });

  const skillsInline = compileSkills(profile, matchResult, rules);
  const skillCount = skillsInline ? skillsInline.split(",").length : 0;
  const courses = learningItems.filter((item) => item.itemType === "course").map(toCourseShape);
  const certifications = learningItems.filter((item) => item.itemType === "certification").map(toCertificationShape);
  const learningCount = courses.length + certifications.length;

  const compilationWarnings = [];
  if (skillCount < MIN_SKILLS) {
    compilationWarnings.push(`Curriculo com apenas ${skillCount} habilidade(s). Recomendado: no minimo ${MIN_SKILLS}. Adicione mais skills ao perfil.`);
  }
  if (learningCount < MIN_LEARNING_ITEMS) {
    compilationWarnings.push(`Curriculo com apenas ${learningCount} curso(s)/certificado(s). Recomendado: no minimo ${MIN_LEARNING_ITEMS}. Adicione mais cursos ou certificacoes ao perfil.`);
  }
  if (projects.length < MIN_PROJECTS) {
    compilationWarnings.push(`Curriculo com apenas ${projects.length} projeto(s). Recomendado: no minimo ${MIN_PROJECTS}. Adicione mais projetos ao perfil.`);
  }

  return compressResume({
    header: {
      name: profile.name,
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
    education: (profile.educations || []).map(toEducationShape),
    projects,
    experiences: (profile.experiences || []).map((experience) => ({
      title: `${experience.role} | ${experience.company}`,
      period: experience.period,
      workload: experience.workload || "",
      description: experience.description || "",
    })),
    skillsInline,
    courses,
    certifications,
    languagesInline: (profile.languages || []).map((item) => [item.name, item.level].filter(Boolean).join(" - ")).join("; "),
    compilationWarnings,
  }, rules);
}

module.exports = {
  compileResume,
  compileSkills,
  uniqueByNormalized,
  rankLearningItems,
  parseHours,
  parseMostRecentYear,
  collectLearnedSkillItems,
  MIN_PROJECTS,
  MIN_LEARNING_ITEMS,
  MIN_SKILLS,
  MAX_PROJECTS,
  MAX_SKILLS,
  MAX_LEARNING_ITEMS,
};
