export const state = {
  user: null,
  token: localStorage.getItem("vagas_token"),
  jobs: [],
  filters: { q: "", status: "", fase: "" },
};
