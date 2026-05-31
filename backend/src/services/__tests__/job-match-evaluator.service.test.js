jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("../../lib/cache", () => ({
  remember: jest.fn((namespace, owner, variant, loader) => loader()),
  invalidate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../profile.service", () => ({}));
jest.mock("../pdf-output.service", () => ({ generateOptimizedResumePdf: jest.fn() }));

const { analyzeProfile } = require("../matching.service");
const { evaluateJobMatch } = require("../../modules/matching/job-match-evaluator.service");

function baseProfile(overrides = {}) {
  return {
    seniority: "junior",
    skillItems: [
      { name: "Node.js" },
      { name: "PostgreSQL" },
      { name: "Docker" },
      { name: "API REST" },
    ],
    projects: [{
      id: "project-api",
      title: "API de candidaturas",
      shortDescription: "API REST com Node.js, PostgreSQL e Docker para gestao de vagas.",
      repositoryUrl: "https://github.com/example/api",
      deployUrl: "https://api.example.com",
      learnedSkills: ["Node.js", "PostgreSQL", "Docker"],
    }],
    courses: [],
    certifications: [],
    educations: [],
    ...overrides,
  };
}

describe("job match evaluator", () => {
  it("perfil com skills aderentes a vaga gera score alto independente de senioridade", () => {
    const junior = evaluateJobMatch({
      profile: baseProfile({ seniority: "junior" }),
      jobTitle: "Desenvolvedor Backend Junior",
      jobDescription: "Vaga junior com Node.js, PostgreSQL, Docker e APIs REST.",
    });
    const senior = evaluateJobMatch({
      profile: baseProfile({ seniority: "senior" }),
      jobTitle: "Desenvolvedor Backend Senior",
      jobDescription: "Vaga senior com Node.js, PostgreSQL, Docker e APIs REST.",
    });

    expect(junior.overallScore).toBeGreaterThanOrEqual(75);
    // senioridade nao afeta o score — mesmo perfil com mesmas skills retorna mesmo aderenciaBase
    expect(junior.aderenciaBase).toBe(senior.aderenciaBase);
    expect(junior.seniorityPenalty).toBe(0);
    expect(senior.seniorityPenalty).toBe(0);
  });

  it("senioridade do perfil nao aplica penalidade nem teto ao score", () => {
    const result = evaluateJobMatch({
      profile: baseProfile({ seniority: "internship" }),
      jobTitle: "Desenvolvedor Backend Senior",
      jobDescription: "Vaga senior com Node.js, PostgreSQL, Docker e APIs REST.",
    });

    expect(result.seniorityPenalty).toBe(0);
    expect(result.overallScore).toBe(result.aderenciaBase);
    expect(result.riskFlags).not.toContain("severe_seniority_mismatch");
    expect(result.riskFlags).not.toContain("seniority_gap");
  });

  it("projetos compativeis aumentam o score", () => {
    const withProject = evaluateJobMatch({
      profile: baseProfile(),
      jobTitle: "Backend Junior",
      jobDescription: "Node.js PostgreSQL Docker API REST.",
    });
    const withoutProject = evaluateJobMatch({
      profile: baseProfile({ projects: [] }),
      jobTitle: "Backend Junior",
      jobDescription: "Node.js PostgreSQL Docker API REST.",
    });

    expect(withProject.scores.projects).toBeGreaterThan(withoutProject.scores.projects);
    expect(withProject.overallScore).toBeGreaterThan(withoutProject.overallScore);
  });

  it("formula e exatamente 70% habilidades + 30% projetos — sem ajuste de senioridade", () => {
    const result = evaluateJobMatch({
      profile: baseProfile(),
      jobTitle: "Backend Junior",
      jobDescription: "Node.js PostgreSQL Docker API REST.",
    });

    const expectedBase = Math.round(result.scores.skills * 0.70 + result.scores.projects * 0.30);
    expect(result.aderenciaBase).toBe(expectedBase);
    expect(result.overallScore).toBe(expectedBase);
    expect(result.scoreDetails.totalScore).toBe(expectedBase);
    expect(result.scoreDetails.weightedBeforePenalty).toBe(expectedBase);
    expect(result.scoringVersion).toBe("ats-v3-skills-projects-no-seniority");
  });

  it("gera warning quando encontra menos de 10 habilidades compativeis", () => {
    const result = evaluateJobMatch({
      profile: baseProfile(),
      jobTitle: "Backend Junior",
      jobDescription: "Node.js PostgreSQL Docker API REST.",
    });

    expect(result.riskFlags).toContain("insufficient_matched_skills");
    expect(result.warnings.join(" ")).toContain("habilidades compativeis");
  });

  it("cursos e certificacoes complementam sem inflar artificialmente o score", () => {
    const result = evaluateJobMatch({
      profile: baseProfile({
        skillItems: [],
        projects: [],
        courses: [{ id: "course", title: "Docker essencial", workload: "40h", period: "2026", learnedSkills: ["Docker"] }],
        certifications: [{ id: "cert", title: "PostgreSQL", workload: "120h", period: "2025", learnedSkills: ["PostgreSQL"] }],
      }),
      jobTitle: "Backend Junior",
      jobDescription: "Node.js PostgreSQL Docker API REST.",
    });

    expect(result.relevantCourses).toHaveLength(1);
    expect(result.relevantCertifications).toHaveLength(1);
    expect(result.overallScore).toBeLessThan(75);
  });

  it("matching individual usa a mesma logica exposta pelo avaliador", () => {
    const profile = baseProfile();
    const metadata = { jobTitle: "Backend Junior", company: "Empresa" };
    const jobDescription = "Node.js PostgreSQL Docker API REST.";

    expect(analyzeProfile(profile, jobDescription, metadata)).toEqual(
      evaluateJobMatch({ profile, jobDescription, ...metadata })
    );
  });

  it("retorna inferredSeniority e confirmedSeniority como metadados sem afetar score", () => {
    const result = evaluateJobMatch({
      profile: baseProfile(),
      jobTitle: "Backend Junior",
      jobDescription: "Node.js PostgreSQL Docker API REST.",
    });

    expect(result).toHaveProperty("inferredSeniority");
    expect(result).toHaveProperty("confirmedSeniority");
    expect(result.seniorityPenalty).toBe(0);
    expect(result.overallScore).toBe(result.aderenciaBase);
  });
});
