const RESUME_LAYOUT_RULES = Object.freeze({
  maxPages: 1,
  maxSummaryChars: 420,
  maxProjects: 2,
  maxProjectBullets: 3,
  maxExperienceBullets: 2,
  maxSkillLines: 2,
  maxSkillGroups: 4,
  maxCoursesAndCertificationsLines: 2,
  maxCoursesAndCertifications: 5,
  titleFontSize: 15,
  sectionFontSize: 10.5,
  bodyFontSize: 9.5,
  lineHeight: 1.05,
  marginCm: 1.3,
});

function compactText(value, limit) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!limit || text.length <= limit) return text;
  return `${text.slice(0, limit - 1).replace(/\s+\S*$/, "").trim()}.`;
}

function estimateLines(value, charsPerLine = 108) {
  return Math.max(1, Math.ceil(String(value || "").length / charsPerLine));
}

function compressResume(resume, rules = RESUME_LAYOUT_RULES) {
  const compact = {
    ...resume,
    summary: compactText(resume.summary, rules.maxSummaryChars),
    experiences: (resume.experiences || []).map((experience) => ({
      ...experience,
      bullets: (experience.bullets || []).slice(0, rules.maxExperienceBullets),
    })),
    projects: (resume.projects || []).slice(0, rules.maxProjects).map((project) => ({
      ...project,
      bullets: (project.bullets || []).slice(0, rules.maxProjectBullets),
    })),
  };

  compact.skillsInline = compactText(compact.skillsInline, 215);
  compact.coursesAndCertificationsInline = compactText(compact.coursesAndCertificationsInline, 215);
  compact.languagesInline = compactText(compact.languagesInline, 108);
  compact.layout = {
    rules,
    skillLines: estimateLines(compact.skillsInline),
    coursesAndCertificationsLines: estimateLines(compact.coursesAndCertificationsInline),
  };
  return compact;
}

module.exports = { RESUME_LAYOUT_RULES, compactText, estimateLines, compressResume };
