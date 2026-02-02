import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";

function buildListParams(filters) {
  const params = new URLSearchParams();

  if (filters && filters.q) params.set("q", filters.q);
  if (filters && filters.status) params.set("status", filters.status);

  if (filters && (filters.period === "last7" || filters.period === "last30")) {
    params.set("period", filters.period);
  } else if (filters && filters.period === "custom") {
    if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.set("dateTo", filters.dateTo);
  }

  return params;
}

function formatPtBRDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

function formatPtBRDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR");
}

function periodLabelFromFilters(filters) {
  const f = filters || {};
  if (f.period === "last7") return "Período: última semana";
  if (f.period === "last30") return "Período: último mês";
  if (f.period === "custom") {
    const from = f.dateFrom || "—";
    const to = f.dateTo || "—";
    return `Período: ${from} até ${to}`;
  }
  return "Período: tudo";
}

export const jobs = {
  async load() {
    const params = buildListParams(state.filters);

    const qs = params.toString();
    const url = qs ? `/jobs?${qs}` : "/jobs";

    const out = await api(url, {}, state.token);
    state.jobs = Array.isArray(out) ? out : [];
    ui.renderJobs();
  },

  async exportPdf() {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      ui.notify("jsPDF não carregou. Verifique o script do CDN.", "error");
      return;
    }

    // Exporta usando os filtros atuais (período selecionado)
    const params = buildListParams(state.filters);
    const qs = params.toString();
    const url = qs ? `/jobs?${qs}` : "/jobs";

    const out = await api(url, {}, state.token);
    const rows = Array.isArray(out) ? out : [];

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "pt", format: "a4" });

    // Layout base
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const marginX = 40;
    const marginTop = 56;
    const marginBottom = 56;
    const line = 14;

    const maxWidth = pageW - marginX * 2;

    let y = marginTop;

    const ensureSpace = (extra = 0) => {
      if (y + extra <= pageH - marginBottom) return;
      doc.addPage();
      y = marginTop;
    };

    const safe = (v) => (v == null ? "" : String(v));
    const yesNo = (v) => (v ? "Sim" : "Não");
    const wrap = (text) => doc.splitTextToSize(safe(text), maxWidth);

    // Header
    const title = "Vagas.io — Exportação de Candidaturas";
    const subtitle = periodLabelFromFilters(state.filters);
    const generatedAt = `Gerado em: ${formatPtBRDateTime(new Date())}`;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(title, marginX, y);
    y += 18;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(subtitle, marginX, y);
    y += 14;
    doc.text(generatedAt, marginX, y);
    y += 18;

    doc.setDrawColor(210);
    doc.line(marginX, y, pageW - marginX, y);
    y += 18;

    if (!rows.length) {
      doc.setFontSize(11);
      doc.text("Nenhum registro encontrado para o período selecionado.", marginX, y);
      doc.save("vagas-io.pdf");
      return;
    }

    // Render “ficha” por vaga (inclui links e textos longos)
    rows.forEach((job, idx) => {
      ensureSpace(160);

      const titulo = safe(job.titulo);
      const empresa = safe(job.empresa);
      const fase = safe(job.fase);
      const status = safe(job.status);

      const dataVaga = job.data;
      const createdAt = job.createdAt;

      const linkVaga = safe(job.linkVaga);
      const linkCV = safe(job.linkCV);

      const acaoNecessaria = !!job.acaoNecessaria;
      const qualAcao = safe(job.qualAcao);
      const prazoAcao = job.prazoAcao;

      const feedbackBool = !!job.feedbackBool;
      const feedbackTxt = safe(job.feedbackTxt);

      // Título do item
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);

      const headLines = wrap(`${idx + 1}. ${titulo || "Sem título"}`);
      doc.text(headLines, marginX, y);
      y += headLines.length * line;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      const lines = [
        `Empresa: ${empresa || "—"}`,
        `Fase: ${fase || "—"}`,
        `Status: ${status || "—"}`,
        `Data (vaga): ${formatPtBRDate(dataVaga)}`,
        `Criado em: ${formatPtBRDateTime(createdAt)}`,
      ];

      lines.forEach((l) => {
        ensureSpace(22);
        const w = wrap(l);
        doc.text(w, marginX, y);
        y += w.length * line;
      });

      // Links (quebrando linha)
      const linkLines = [
        `Link da vaga: ${linkVaga || "—"}`,
        `Link do currículo: ${linkCV || "—"}`,
      ];

      linkLines.forEach((l) => {
        ensureSpace(28);
        const w = wrap(l);
        doc.text(w, marginX, y);
        y += w.length * line;
      });

      // Ação
      ensureSpace(22);
      const a1 = wrap(`Exige ação?: ${yesNo(acaoNecessaria)}`);
      doc.text(a1, marginX, y);
      y += a1.length * line;

      if (acaoNecessaria) {
        const a2 = wrap(`Qual ação: ${qualAcao || "—"}`);
        ensureSpace(a2.length * line + 8);
        doc.text(a2, marginX, y);
        y += a2.length * line;

        const a3 = wrap(`Prazo: ${formatPtBRDate(prazoAcao)}`);
        ensureSpace(a3.length * line + 8);
        doc.text(a3, marginX, y);
        y += a3.length * line;
      }

      // Feedback
      ensureSpace(22);
      const f1 = wrap(`Recebeu feedback?: ${yesNo(feedbackBool)}`);
      doc.text(f1, marginX, y);
      y += f1.length * line;

      if (feedbackBool && feedbackTxt) {
        const f2 = wrap(`Feedback: ${feedbackTxt}`);
        ensureSpace(f2.length * line + 8);
        doc.text(f2, marginX, y);
        y += f2.length * line;
      }

      // Separador entre itens
      ensureSpace(24);
      y += 6;
      doc.setDrawColor(230);
      doc.line(marginX, y, pageW - marginX, y);
      y += 18;
    });

    doc.save("vagas-io.pdf");
  },

  async save(payload) {
    const hasId = Boolean(payload.id);
    const endpoint = hasId ? `/jobs/${payload.id}` : "/jobs";
    const method = hasId ? "PUT" : "POST";

    const body = {
      titulo: payload.titulo,
      empresa: payload.empresa,
      linkVaga: payload.linkVaga,
      linkCV: payload.linkCV,
      data: payload.data,
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
