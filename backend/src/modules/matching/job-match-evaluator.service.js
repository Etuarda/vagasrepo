const { classifyJob, normalizeTerm, normalizeText } = require("./keyword-normalizer");
const { rankProjects } = require("./project-ranking.service");
const { rankLearningItems, collectLearnedSkillItems } = require("../resume/resume-compiler.service");
const { TRANSVERSAL_SKILLS } = require("../../shared/constants/tech-dictionary");

const SENIORITY_ALIASES = Object.freeze({
  internship: ["internship", "intern", "trainee", "estagio", "estagiario", "estagiaria"],
  junior: ["junior", "jr", "junior"],
  mid: ["mid", "middle", "pleno"],
  senior: ["senior", "sr", "senior"],
  lead: ["lead", "lider", "tech lead", "principal", "staff", "specialist", "especialista"],
  unknown: ["unknown", "nao informado", "indefinido"],
});

const SENIORITY_ORDER = Object.freeze({
  internship: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  unknown: -1,
});

const WEIGHTS = Object.freeze({
  skills: 0.70,
  projects: 0.30,
});

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function scoreRatio(matched, total) {
  return total ? Math.round((matched / total) * 100) : 0;
}

function normalizeSeniorityLevel(value) {
  const normalized = normalizeTerm(value);
  for (const [level, aliases] of Object.entries(SENIORITY_ALIASES)) {
    if (aliases.map(normalizeTerm).includes(normalized)) return level;
  }
  return Object.prototype.hasOwnProperty.call(SENIORITY_ORDER, normalized) ? normalized : "unknown";
}

function inferSeniority(text) {
  const normalized = ` ${normalizeText(String(text || "").replace(/[\/|,.;:()[\]{}]/g, " "))} `;
  const matches = Object.entries(SENIORITY_ALIASES)
    .filter(([level, aliases]) => level !== "unknown" && aliases.some((alias) => normalized.includes(` ${normalizeTerm(alias)} `)))
    .map(([level]) => level);
  return matches.sort((a, b) => SENIORITY_ORDER[b] - SENIORITY_ORDER[a])[0] || "unknown";
}

function validStructuredProject(project) {
  const title = String(project.title || "").trim();
  const normalizedTitle = normalizeText(title);
  return title.length >= 2 &&
    !/^(modelagem|otimizacao|implementacao|construcao|desenvolvimento|integracao)\b/i.test(normalizedTitle) &&
    Boolean(String(project.shortDescription || "").trim());
}

function splitKeywords(required) {
  const transversal = new Set((TRANSVERSAL_SKILLS || []).map(normalizeTerm));
  const competencies = required.filter((keyword) => transversal.has(normalizeTerm(keyword)));
  const technical = required.filter((keyword) => !transversal.has(normalizeTerm(keyword)));
  return { technical, competencies };
}

function weightedScore(scores) {
  return Math.round(
    scores.skills * WEIGHTS.skills +
    scores.projects * WEIGHTS.projects
  );
}

function evaluateJobMatch(input = {}) {
  const profile = input.profile || {};
  const jobText = [input.jobTitle, input.company, input.jobDescription].filter(Boolean).join(" ");
  const job = classifyJob(jobText);
  const required = unique(input.jobKeywords || job.keywords);
  const { technical, competencies } = splitKeywords(required);
  const skillMap = new Map([
    ...(profile.skillItems || []),
    ...collectLearnedSkillItems(profile),
  ].map((skill) => [normalizeTerm(skill.name), skill]));

  const matchedRequired = required.filter((keyword) => skillMap.has(normalizeTerm(keyword)));
  const matchedCompetencies = competencies.filter((keyword) => skillMap.has(normalizeTerm(keyword)));
  const matchedSkills = unique(matchedRequired.map((keyword) => skillMap.get(normalizeTerm(keyword)).name));
  const missingSkills = required.filter((keyword) => !skillMap.has(normalizeTerm(keyword)));

  const validProjects = (profile.projects || []).filter(validStructuredProject);
  const matchedProjects = rankProjects(validProjects, required, input.projectLimit || 2)
    .filter((project) => project.score > 0 && project.matchedKeywords.length > 0);
  const learningItems = rankLearningItems(profile, { jobKeywords: required }, 5);
  const relevantCertifications = learningItems.filter((item) => item.itemType === "certification");
  const relevantCourses = learningItems.filter((item) => item.itemType === "course");

  const inferredSeniority = inferSeniority(jobText);
  const skillsScore = scoreRatio(matchedRequired.length, required.length);
  const projectsScore = matchedProjects.length
    ? Math.round(matchedProjects.reduce((sum, item) => sum + item.score, 0) / matchedProjects.length)
    : 0;
  const learningScore = required.length
    ? scoreRatio(unique(learningItems.flatMap((item) => item.matchedKeywords)).length, required.length)
    : 0;
  const competenciesScore = competencies.length ? scoreRatio(matchedCompetencies.length, competencies.length) : 50;
  const extraRelevantSkills = unique([...skillMap.values()]
    .map((skill) => skill.name)
    .filter((name) => !matchedSkills.map(normalizeTerm).includes(normalizeTerm(name)))
    .slice(0, 10));
  const scores = {
    skills: skillsScore,
    projects: projectsScore,
    learning: learningScore,
    competencies: competenciesScore,
  };
  const aderenciaBase = weightedScore(scores);
  const overallScore = aderenciaBase;
  const riskFlags = [];
  if (!required.length) riskFlags.push("no_job_keywords_detected");
  if (matchedSkills.length < 10) riskFlags.push("insufficient_matched_skills");
  if (!validProjects.length) riskFlags.push("no_structured_projects");
  if (validProjects.length && !matchedProjects.length) riskFlags.push("no_compatible_projects");
  if (validProjects.length !== (profile.projects || []).length) riskFlags.push("invalid_projects_ignored");
  if (learningItems.length < 5) riskFlags.push("insufficient_learning_items");

  return {
    overallScore,
    score: overallScore,
    scores: { ...scores, aderenciaBase },
    scoreDetails: {
      skillsMatchScore: skillsScore,
      skillsAndCertificationsMatchScore: skillsScore,
      projectsMatchScore: projectsScore,
      coursesAndCertificationsMatchScore: learningScore,
      competenciesMatchScore: competenciesScore,
      weightedBeforePenalty: aderenciaBase,
      aderenciaBase,
      totalScore: overallScore,
    },
    matchedSkills,
    missingSkills,
    matchedProjects,
    selectedProjects: matchedProjects,
    relevantCourses,
    relevantCertifications,
    selectedCourses: relevantCourses,
    selectedCertifications: relevantCertifications,
    jobCategory: job.category,
    jobKeywords: required,
    extraRelevantSkills,
    matchedTechnologies: matchedSkills,
    missingTechnologies: missingSkills,
    projectScores: matchedProjects.map((project) => ({ project, score: project.score, reason: project.reason })),
    seniorityPenalty: 0,
    aderenciaBase,
    aderenciaFinal: overallScore,
    scoringVersion: "ats-v3-skills-projects-no-seniority",
    inferredSeniority,
    confirmedSeniority: input.confirmedSeniority
      ? normalizeSeniorityLevel(input.confirmedSeniority)
      : inferredSeniority,
    explanation: "Score calculado por habilidades 70% e projetos 30%. Senioridade nao afeta o calculo.",
    riskFlags,
    warnings: riskFlags.map((flag) => ({
      no_job_keywords_detected: "Nenhuma keyword tecnica reconhecida na vaga; revise a descricao informada.",
      insufficient_matched_skills: `Foram encontradas apenas ${matchedSkills.length} habilidades compativeis com a vaga.`,
      no_structured_projects: "Nao ha projetos estruturados suficientes para gerar um curriculo otimizado com qualidade.",
      no_compatible_projects: "Nenhum projeto compatível com a vaga foi encontrado.",
      insufficient_learning_items: `Foram encontrados apenas ${learningItems.length} cursos ou certificações compatíveis com a vaga.`,
      invalid_projects_ignored: "Projetos sem estrutura valida foram ignorados; revise os dados cadastrados no perfil.",
    }[flag])).filter(Boolean),
  };
}

module.exports = {
  WEIGHTS,
  evaluateJobMatch,
  inferSeniority,
  normalizeSeniorityLevel,
  validStructuredProject,
};
