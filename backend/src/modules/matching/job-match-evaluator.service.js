const { classifyJob, normalizeTerm, normalizeText } = require("./keyword-normalizer");
const { rankProjects } = require("./project-ranking.service");
const { rankLearningItems, collectLearnedSkillItems } = require("../resume/resume-compiler.service");
const { TRANSVERSAL_SKILLS } = require("../../shared/constants/tech-dictionary");

const SENIORITY_ORDER = Object.freeze({
  internship: 0,
  junior: 1,
  mid: 2,
  senior: 3,
  lead: 4,
  unknown: -1,
});

const SENIORITY_ALIASES = Object.freeze({
  internship: ["internship", "intern", "trainee", "estagio", "estagiario", "estagiaria"],
  junior: ["junior", "jr", "junior"],
  mid: ["mid", "middle", "pleno"],
  senior: ["senior", "sr", "senior"],
  lead: ["lead", "lider", "tech lead", "principal", "staff", "specialist", "especialista"],
  unknown: ["unknown", "nao informado", "indefinido"],
});

const WEIGHTS = Object.freeze({
  seniority: 0.30,
  technicalSkills: 0.25,
  projects: 0.25,
  learning: 0.10,
  competencies: 0.10,
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

function evaluateSeniority(profileSeniority, jobText) {
  const profile = normalizeSeniorityLevel(profileSeniority);
  const job = inferSeniority(jobText);
  const riskFlags = [];

  if (job === "unknown") {
    riskFlags.push("seniority_not_explicit");
    return {
      match: { profile, job, score: 85, inferred: true, compatible: true, distance: null },
      penalty: 5,
      cap: null,
      riskFlags,
    };
  }

  if (profile === "unknown") {
    riskFlags.push("profile_seniority_unknown");
    return {
      match: { profile, job, score: 70, inferred: true, compatible: false, distance: null },
      penalty: 15,
      cap: 80,
      riskFlags,
    };
  }

  const distance = SENIORITY_ORDER[job] - SENIORITY_ORDER[profile];
  if (distance <= 0) {
    return {
      match: { profile, job, score: 100, inferred: true, compatible: true, distance },
      penalty: 0,
      cap: null,
      riskFlags,
    };
  }

  if (distance === 1) {
    riskFlags.push("seniority_gap");
    return {
      match: { profile, job, score: 65, inferred: true, compatible: false, distance },
      penalty: 20,
      cap: 74,
      riskFlags,
    };
  }

  riskFlags.push("severe_seniority_mismatch");
  return {
    match: { profile, job, score: 25, inferred: true, compatible: false, distance },
    penalty: 45,
    cap: 59,
    riskFlags,
  };
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
    scores.seniority * WEIGHTS.seniority +
    scores.technicalSkills * WEIGHTS.technicalSkills +
    scores.projects * WEIGHTS.projects +
    scores.learning * WEIGHTS.learning +
    scores.competencies * WEIGHTS.competencies
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
  const matchedTechnical = technical.filter((keyword) => skillMap.has(normalizeTerm(keyword)));
  const matchedCompetencies = competencies.filter((keyword) => skillMap.has(normalizeTerm(keyword)));
  const matchedSkills = unique(matchedRequired.map((keyword) => skillMap.get(normalizeTerm(keyword)).name));
  const missingSkills = required.filter((keyword) => !skillMap.has(normalizeTerm(keyword)));

  const validProjects = (profile.projects || []).filter(validStructuredProject);
  const matchedProjects = rankProjects(validProjects, required, input.projectLimit || 2);
  const learningItems = rankLearningItems(profile, { jobKeywords: required }, 5);
  const relevantCertifications = learningItems.filter((item) => item.itemType === "certification");
  const relevantCourses = learningItems.filter((item) => item.itemType === "course");

  const seniority = evaluateSeniority(profile.seniority, jobText);
  const technicalSkillsScore = scoreRatio(matchedTechnical.length, technical.length || required.length);
  const projectsScore = matchedProjects.length
    ? Math.round(matchedProjects.reduce((sum, item) => sum + item.score, 0) / matchedProjects.length)
    : 0;
  const learningScore = required.length
    ? scoreRatio(unique(learningItems.flatMap((item) => item.matchedKeywords)).length, required.length)
    : 0;
  const competenciesScore = competencies.length ? scoreRatio(matchedCompetencies.length, competencies.length) : 50;
  const scores = {
    seniority: seniority.match.score,
    technicalSkills: technicalSkillsScore,
    projects: projectsScore,
    learning: learningScore,
    competencies: competenciesScore,
  };
  const weightedBeforePenalty = weightedScore(scores);
  const penalizedScore = Math.max(0, weightedBeforePenalty - seniority.penalty);
  const overallScore = seniority.cap === null ? penalizedScore : Math.min(penalizedScore, seniority.cap);
  const riskFlags = [...seniority.riskFlags];
  if (!required.length) riskFlags.push("no_job_keywords_detected");
  if (!validProjects.length) riskFlags.push("no_structured_projects");
  if (validProjects.length !== (profile.projects || []).length) riskFlags.push("invalid_projects_ignored");

  return {
    overallScore,
    score: overallScore,
    scores: { ...scores, weightedBeforePenalty },
    scoreDetails: {
      skillsMatchScore: technicalSkillsScore,
      skillsAndCertificationsMatchScore: Math.round(technicalSkillsScore * 0.75 + learningScore * 0.25),
      projectsMatchScore: projectsScore,
      coursesAndCertificationsMatchScore: learningScore,
      competenciesMatchScore: competenciesScore,
      seniorityMatchScore: seniority.match.score,
      weightedBeforePenalty,
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
    matchedTechnologies: matchedSkills,
    missingTechnologies: missingSkills,
    projectScores: matchedProjects.map((project) => ({ project, score: project.score, reason: project.reason })),
    seniorityMatch: seniority.match,
    seniorityPenalty: seniority.penalty,
    profileSeniority: seniority.match.profile,
    jobSeniority: seniority.match.job,
    explanation: `Score calculado por senioridade 30%, habilidades 25%, projetos 25%, cursos/certificacoes 10% e competencias 10%. Penalidade de senioridade aplicada: ${seniority.penalty} pontos.`,
    riskFlags,
    warnings: riskFlags.map((flag) => ({
      no_job_keywords_detected: "Nenhuma keyword tecnica reconhecida na vaga; revise a descricao informada.",
      no_structured_projects: "Nao ha projetos estruturados suficientes para gerar um curriculo otimizado com qualidade.",
      invalid_projects_ignored: "Projetos sem estrutura valida foram ignorados; revise os dados cadastrados no perfil.",
      severe_seniority_mismatch: "A senioridade da vaga esta muito acima da senioridade do perfil.",
      seniority_gap: "A senioridade da vaga esta acima da senioridade do perfil.",
      seniority_not_explicit: "Senioridade da vaga nao informada explicitamente; foi aplicada penalidade menor.",
      profile_seniority_unknown: "Senioridade do perfil nao informada; o score foi limitado.",
    }[flag])).filter(Boolean),
  };
}

module.exports = {
  SENIORITY_ORDER,
  WEIGHTS,
  evaluateJobMatch,
  inferSeniority,
  normalizeSeniorityLevel,
  validStructuredProject,
};
