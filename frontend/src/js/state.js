export const state = {
  user: null,
  token: localStorage.getItem("vagas_token"),
  jobs: [],
  profile: null,
  profiles: [],
  activeProfileId: localStorage.getItem("vagas_active_profile_id") || "",
  matchHistory: [],
  resumeFiles: [],
  filters: {
    q: "",
    status: "",
    period: "all", // all | last7 | last30 | custom
    dateFrom: "",
    dateTo: "",
  },
};
