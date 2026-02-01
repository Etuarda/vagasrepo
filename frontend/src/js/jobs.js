import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";

export const jobs = {
  async load() {
    const params = new URLSearchParams();
    if (state.filters.q) params.set("q", state.filters.q);
    if (state.filters.status) params.set("status", state.filters.status);
    if (state.filters.fase) params.set("fase", state.filters.fase);

    state.jobs = await api(`/jobs?${params.toString()}`, {}, state.token);
    ui.renderJobs();
  },

  async save(payload) {
    const hasId = Boolean(payload.id);
    const endpoint = hasId ? `/jobs/${payload.id}` : "/jobs";
    const method = hasId ? "PUT" : "POST";

    // Backend exige feedbackBool e feedbackTxt (se true)
    // e exige qualAcao (se acaoNecessaria true)
    const body = {
      titulo: payload.titulo,
      empresa: payload.empresa,
      linkVaga: payload.linkVaga,
      linkCV: payload.linkCV,
      data: payload.data, // YYYY-MM-DD -> z.coerce.date
      status: payload.status,
      fase: payload.fase,
      acaoNecessaria: payload.acaoNecessaria,
      qualAcao: payload.acaoNecessaria ? (payload.qualAcao || "") : undefined,
      prazoAcao: payload.acaoNecessaria && payload.prazoAcao ? payload.prazoAcao : undefined,
      feedbackBool: payload.feedbackBool,
      feedbackTxt: payload.feedbackBool ? (payload.feedbackTxt || "") : undefined,
    };

    await api(endpoint, { method, body: JSON.stringify(body) }, state.token);

    ui.closeJobModal();
    await jobs.load();
    ui.notify("Registro arquivado.");
  },

  async remove(id) {
    const ok = confirm("Remover este registro?");
    if (!ok) return;

    await api(`/jobs/${id}`, { method: "DELETE" }, state.token);
    await jobs.load();
  },
};
