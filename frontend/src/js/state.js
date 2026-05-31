const transitionalToken = sessionStorage.getItem("vagas_legacy_token") || localStorage.getItem("vagas_token");
localStorage.removeItem("vagas_token");

export const state = {
  user: null,
  billing: null,
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
    titulo: "",
    empresa: "",
    linkVaga: "",
    status: "",
    fase: "",
    subprofileId: "",
    origin: "",
    period: "month", // day | week | month | all | custom
    dateFrom: "",
    dateTo: "",
  },
};
