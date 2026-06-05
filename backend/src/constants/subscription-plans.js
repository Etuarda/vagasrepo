const PLAN_KEYS = Object.freeze({
  FREE: "free",
  PREMIUM: "premium",
});

const FEATURES = Object.freeze({
  MATCHING_ANALYSIS: "matching_analysis",
  SHARED_MATCHED_JOBS: "shared_matched_jobs",
  SUBPROFILES: "subprofiles",
  APPLICATION_TRACKING: "application_tracking",
});

const PLAN_RULES = Object.freeze({
  [PLAN_KEYS.FREE]: Object.freeze({
    priceCents: 0,
    matchingLimit: 3,
    matchingPeriod: "lifetime",
    maxSubprofiles: 0,
    maxTrackedApplications: 0,
    sharedMatchedJobs: false,
    applicationTracking: false,
  }),
  [PLAN_KEYS.PREMIUM]: Object.freeze({
    priceCents: 2990,
    matchingLimit: 500,
    matchingPeriod: "monthly",
    maxSubprofiles: 10,
    maxTrackedApplications: null,
    sharedMatchedJobs: true,
    applicationTracking: true,
  }),
});

const PLAN_DETAILS = Object.freeze({
  [PLAN_KEYS.FREE]: Object.freeze({
    name: "Free",
    priceLabel: "R$ 0,00",
    description: "Teste o matching com 1 Perfil Global.",
    benefits: [
      "3 analises de matching vitalicias",
      "1 Perfil Global",
      "Pode gerar curriculo otimizado a partir das analises disponiveis",
      "Sem acesso a vagas compartilhadas, subperfis e acompanhamento de vagas",
    ],
  }),
  [PLAN_KEYS.PREMIUM]: Object.freeze({
    name: "Pro",
    priceLabel: "R$ 29,90/mes",
    description: "Acesso completo com todas as funcionalidades.",
    benefits: [
      "500 analises de matching por mes",
      "Ate 10 subperfis profissionais",
      "Acesso ao mural de vagas compartilhadas",
      "Acompanhamento de candidaturas sem limite visivel",
      "Geracao de curriculos otimizados",
      "Historico de analises",
      "Suporte ao Perfil Global e subperfis",
    ],
  }),
});

module.exports = { PLAN_KEYS, FEATURES, PLAN_RULES, PLAN_DETAILS };
