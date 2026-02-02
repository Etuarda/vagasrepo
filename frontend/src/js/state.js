export const state = {
  user: null,
  token: localStorage.getItem("vagas_token"),
  jobs: [],
  filters: {
    q: "",
    status: "",
    period: "all", // all | last7 | last30 | custom
    dateFrom: "",
    dateTo: "",
  },
};
