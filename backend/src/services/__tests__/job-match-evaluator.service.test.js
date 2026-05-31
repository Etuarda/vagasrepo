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
  it("perfil junior em vaga junior compativel gera score alto", () => {
    const result = evaluateJobMatch({
      profile: baseProfile(),
      jobTitle: "Desenvolvedor Backend Junior",
      jobDescription: "Vaga junior com Node.js, PostgreSQL, Docker e APIs REST.",
    });

    expect(result.overallScore).toBeGreaterThanOrEqual(75);
    expect(result.seniorityMatch).toEqual(expect.objectContaining({ profile: "junior", job: "junior", compatible: true }));
    expect(result.matchedSkills).toEqual(expect.arrayContaining(["Node.js", "PostgreSQL", "Docker"]));
  });

  it("perfil junior em vaga senior aplica penalidade forte e limita o score", () => {
    const result = evaluateJobMatch({
      profile: baseProfile(),
      jobTitle: "Desenvolvedor Backend Senior",
      jobDescription: "Vaga senior com Node.js, PostgreSQL, Docker e APIs REST.",
    });

    expect(result.overallScore).toBeLessThanOrEqual(59);
    expect(result.seniorityPenalty).toBeGreaterThanOrEqual(35);
    expect(result.riskFlags).toContain("severe_seniority_mismatch");
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

  it("usa formula base exata de 70% habilidades e 30% projetos antes da senioridade", () => {
    const result = evaluateJobMatch({
      profile: baseProfile({ seniority: "junior" }),
      jobTitle: "Backend Junior",
      jobDescription: "Node.js PostgreSQL Docker API REST.",
      confirmedSeniority: "junior",
    });

    const expectedBase = Math.round(
      result.scores.skills * 0.70 +
      result.scores.projects * 0.30
    );
    expect(result.aderenciaBase).toBe(expectedBase);
    expect(result.scoreDetails.weightedBeforePenalty).toBe(expectedBase);
  });

  it("gera warning quando encontra menos de 10 habilidades compativeis", () => {
    const result = evaluateJobMatch({
      profile: baseProfile(),
      jobTitle: "Backend Junior",
      jobDescription: "Node.js PostgreSQL Docker API REST.",
      confirmedSeniority: "junior",
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
});
