const transitionalToken = sessionStorage.getItem("vagas_legacy_token") || localStorage.getItem("vagas_token");
localStorage.removeItem("vagas_token");

export const state = {
  user: null,
  token: transitionalToken,
  jobs: [],
  profile: null,
  profiles: [],
  activeProfileId: "",
  matchHistory: [],
  sharedMatchedJobs: [],
  sharedMatchedJobsPeriod: "month",
  pendingApplicationAnalysis: null,
  lastMatchResult: null,
  resumeFiles: [],
  filters: {
    q: "",
    status: "",
    period: "all", // all | last7 | last30 | custom
    dateFrom: "",
    dateTo: "",
  },
};
