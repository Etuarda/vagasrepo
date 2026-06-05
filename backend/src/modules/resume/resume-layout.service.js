const RESUME_LAYOUT_RULES = Object.freeze({
  maxPages: 2,
  maxProjects: 2,
  maxLearningItems: 5,
  minSkills: 15,
  maxSkills: 30,
  maxSkillLines: 3,
  maxSkillGroups: 4,
  titleFontSize: 23,
  sectionFontSize: 13,
  bodyFontSize: 11,
  metadataFontSize: 10,
  bulletFontSize: 10.5,
  lineHeight: 1.2,
  marginCm: 1.3,
});

function estimateLines(value, charsPerLine = 108) {
  return Math.max(1, Math.ceil(String(value || "").length / charsPerLine));
}

function compressResume(resume, rules = RESUME_LAYOUT_RULES) {
  const compact = {
    ...resume,
    projects: (resume.projects || []).slice(0, rules.maxProjects),
  };
  const learningItems = [
    ...(resume.certifications || []).map((item) => ({ ...item, __type: "certification" })),
    ...(resume.courses || []).map((item) => ({ ...item, __type: "course" })),
  ].slice(0, rules.maxLearningItems);
  compact.certifications = learningItems
    .filter((item) => item.__type === "certification")
    .map(({ __type, ...item }) => item);
  compact.courses = learningItems
    .filter((item) => item.__type === "course")
    .map(({ __type, ...item }) => item);

  compact.layout = {
    rules,
    skillLines: estimateLines(compact.skillsInline),
  };
  return compact;
}

module.exports = { RESUME_LAYOUT_RULES, estimateLines, compressResume };
