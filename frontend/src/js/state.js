export const state = {
  user: null,
  token: localStorage.getItem("vagas_token"),
  jobs: [],
  profile: null,
  profiles: [],
  activeProfileId: "",
  matchHistory: [],
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
