const PLAN_KEYS = Object.freeze({
  FREE: "free",
  BASIC: "basic",
  PRO: "pro",
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
  [PLAN_KEYS.BASIC]: Object.freeze({
    priceCents: 990,
    matchingLimit: 30,
    matchingPeriod: "monthly",
    maxSubprofiles: 0,
    maxTrackedApplications: null,
    sharedMatchedJobs: true,
    applicationTracking: true,
  }),
  [PLAN_KEYS.PRO]: Object.freeze({
    priceCents: 1990,
    matchingLimit: 100,
    matchingPeriod: "monthly",
    maxSubprofiles: 5,
    maxTrackedApplications: null,
    sharedMatchedJobs: true,
    applicationTracking: true,
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
  [PLAN_KEYS.BASIC]: Object.freeze({
    name: "Basic",
    priceLabel: "R$ 9,90/mes",
    description: "Acesso completo sem subperfis.",
    benefits: [
      "30 analises de matching por mes",
      "Vagas compartilhadas com percentual de aderencia ao perfil",
      "Acompanhamento de candidaturas",
      "Geracao de curriculos otimizados",
    ],
  }),
  [PLAN_KEYS.PRO]: Object.freeze({
    name: "Pro",
    priceLabel: "R$ 19,90/mes",
    description: "Mais volume e ate 5 subperfis.",
    benefits: [
      "100 analises de matching por mes",
      "Ate 5 subperfis profissionais",
      "Vagas compartilhadas com aderencia por skills e senioridade",
      "Todas as funcionalidades de matching, curriculo e acompanhamento",
    ],
  }),
  [PLAN_KEYS.PREMIUM]: Object.freeze({
    name: "Premium",
    priceLabel: "R$ 29,90/mes",
    description: "Maior limite operacional.",
    benefits: [
      "500 analises de matching por mes",
      "Ate 10 subperfis profissionais",
      "Vagas compartilhadas com aderencia por skills e senioridade",
      "Todas as funcionalidades sem limite visivel de candidaturas acompanhadas",
    ],
  }),
});

module.exports = { PLAN_KEYS, FEATURES, PLAN_RULES, PLAN_DETAILS };
