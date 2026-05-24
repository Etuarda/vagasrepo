const { SKILL_GROUPS, CATEGORY_KEYWORDS } = require("../../shared/constants/tech-dictionary");
const { normalizeTerm } = require("../matching/keyword-normalizer");
const { compressResume, RESUME_LAYOUT_RULES, compactText } = require("./resume-layout.service");

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
  const ordered = uniqueByNormalized(matched.length || (matchResult.jobKeywords || []).length ? matched : [...catalog.values()].slice(0, 12));
  const groups = new Map();
  ordered.forEach((skill) => {
    const inferredCategory = Object.entries(CATEGORY_KEYWORDS).find(([, terms]) =>
      terms.map(normalizeTerm).includes(normalizeTerm(skill.name))
    )?.[0];
    const group = SKILL_GROUPS[skill.category !== "other" ? skill.category : inferredCategory] || SKILL_GROUPS.other;
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(skill.name);
  });
  return [...groups.entries()].slice(0, rules.maxSkillGroups)
    .map(([label, items]) => `${label}: ${items.join(", ")}`).join(" | ");
}

function formatTraining(item, certification = false) {
  const institution = certification ? item.issuer : item.institution;
  return [item.title, institution, item.period].filter(Boolean).join(" | ");
}

function compileResume({ profile, matchResult, rules = RESUME_LAYOUT_RULES }) {
  const inferredEducation = (profile.courses || []).filter((item) =>
    /gradu|bacharel|licenciatura|tecnologo|universidade|faculdade/i.test(`${item.title} ${item.institution}`)
  );
  const selectedTraining = [
    ...(matchResult.selectedCourses || []).filter((item) => !inferredEducation.some((education) => education.id === item.id)).map((item) => formatTraining(item)),
    ...(matchResult.selectedCertifications || []).map((item) => formatTraining(item, true)),
  ].slice(0, rules.maxCoursesAndCertifications);
  const projects = (matchResult.selectedProjects || []).map((project) => ({
    id: project.id,
    title: project.customTitle || project.title,
    stack: (project.technologies || []).slice(0, 6).join(", "),
    links: [project.repositoryUrl && "GitHub", project.deployUrl && "Deploy"].filter(Boolean).join(" / "),
    repositoryUrl: project.repositoryUrl,
    deployUrl: project.deployUrl,
    bullets: (project.selectedBullets || []).length
      ? project.selectedBullets.map((bullet) => compactText(bullet.content, 180))
      : [compactText(project.shortDescription || project.description, 180)].filter(Boolean),
  }));

  return compressResume({
    header: {
      name: profile.name,
      title: profile.title || matchResult.targetTitle,
      contactInline: [profile.location, profile.emailContact, profile.phone, profile.linkedin, profile.github, profile.lattes].filter(Boolean).join(" | "),
    },
    summary: profile.summary || "",
    education: (profile.educations || []).length ? profile.educations : inferredEducation,
    skillsInline: compileSkills(profile, matchResult, rules),
    experiences: (matchResult.selectedExperiences || []).map((experience) => ({
      title: `${experience.role} | ${experience.company}`,
      period: experience.period,
      bullets: (experience.selectedBullets || [experience.description]).filter(Boolean),
    })),
    projects,
    coursesAndCertificationsInline: selectedTraining.join("; "),
    languagesInline: (profile.languages || []).map((item) => [item.name, item.level].filter(Boolean).join(" - ")).join("; "),
  }, rules);
}

module.exports = { compileResume, compileSkills, formatTraining, uniqueByNormalized };
