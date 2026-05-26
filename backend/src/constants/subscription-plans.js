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
    maxTrackedApplications: 10,
    sharedMatchedJobs: false,
  }),
  [PLAN_KEYS.BASIC]: Object.freeze({
    priceCents: 990,
    matchingLimit: 30,
    matchingPeriod: "monthly",
    maxSubprofiles: 2,
    maxTrackedApplications: null,
    sharedMatchedJobs: true,
  }),
  [PLAN_KEYS.PRO]: Object.freeze({
    priceCents: 1990,
    matchingLimit: 100,
    matchingPeriod: "monthly",
    maxSubprofiles: 5,
    maxTrackedApplications: null,
    sharedMatchedJobs: true,
  }),
  [PLAN_KEYS.PREMIUM]: Object.freeze({
    priceCents: 2990,
    matchingLimit: 500,
    matchingPeriod: "monthly",
    maxSubprofiles: 10,
    maxTrackedApplications: null,
    sharedMatchedJobs: true,
  }),
});

module.exports = { PLAN_KEYS, FEATURES, PLAN_RULES };
