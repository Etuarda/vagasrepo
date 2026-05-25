const RESUME_LAYOUT_RULES = Object.freeze({
  maxPages: 2,
  maxProjects: 2,
  maxProjectBullets: 3,
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
    projects: (resume.projects || []).slice(0, rules.maxProjects).map((project) => ({
      ...project,
      bullets: (project.bullets || []).slice(0, rules.maxProjectBullets),
    })),
  };

  compact.layout = {
    rules,
    skillLines: estimateLines(compact.skillsInline),
  };
  return compact;
}

module.exports = { RESUME_LAYOUT_RULES, estimateLines, compressResume };
