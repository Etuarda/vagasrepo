const { SKILL_GROUPS, CATEGORY_KEYWORDS, TRANSVERSAL_SKILLS } = require("../../shared/constants/tech-dictionary");
const { normalizeTerm } = require("../matching/keyword-normalizer");
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
  const transversal = [...catalog.values()].filter((skill) => TRANSVERSAL_SKILLS.includes(normalizeTerm(skill.name)));
  const targeted = matched.length || (matchResult.jobKeywords || []).length ? matched : [...catalog.values()].slice(0, 12);
  const ordered = uniqueByNormalized([...targeted, ...transversal]);
  const groups = new Map();
  ordered.forEach((skill) => {
    if (TRANSVERSAL_SKILLS.includes(normalizeTerm(skill.name))) {
      if (!groups.has("Praticas/Versionamento")) groups.set("Praticas/Versionamento", []);
      groups.get("Praticas/Versionamento").push(skill.name);
      return;
    }
    const inferredCategory = Object.entries(CATEGORY_KEYWORDS).find(([, terms]) =>
      terms.map(normalizeTerm).includes(normalizeTerm(skill.name))
    )?.[0];
    const group = SKILL_GROUPS[skill.category !== "other" ? skill.category : inferredCategory] || SKILL_GROUPS.other;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(skill.name);
  });
  const transversalGroup = groups.has("Praticas/Versionamento")
    ? [["Praticas/Versionamento", groups.get("Praticas/Versionamento")]]
    : [];
  const selectedGroups = [...groups.entries()]
    .filter(([label]) => label !== "Praticas/Versionamento")
    .slice(0, rules.maxSkillGroups - transversalGroup.length)
    .concat(transversalGroup);
  return selectedGroups
    .map(([label, items]) => `${label}: ${items.join(", ")}`).join(" | ");
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
    courses: profile.courses || [],
    certifications: profile.certifications || [],
    languagesInline: (profile.languages || []).map((item) => [item.name, item.level].filter(Boolean).join(" - ")).join("; "),
  }, rules);
}

module.exports = { compileResume, compileSkills, uniqueByNormalized };
