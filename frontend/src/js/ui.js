import { state } from "./state.js";
import { toast } from "./toast.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(value) {
  const name = String(value || "").trim();
  if (!name || name.includes("@")) return "";
  return name.split(/\s+/)[0];
}

export const ui = {
  navigate(view) {
    ["landing", "dashboard"].forEach((v) => {
      const el = document.getElementById(`view-${v}`);
      if (el) el.classList.add("hidden");
    });

    const target = document.getElementById(`view-${view}`);
    if (target) target.classList.remove("hidden");
  },

  toggleContrast() {
    document.body.classList.toggle("high-contrast");
    const enabled = document.body.classList.contains("high-contrast");
    document.querySelector("[data-toggle-contrast]")?.setAttribute("aria-pressed", String(enabled));
    localStorage.setItem(
      "vagas_contrast",
      String(enabled)
    );
  },

  renderNav() {
    const nav = document.getElementById("nav-actions");
    if (!nav) return;

    if (state.user) {
      const greetingName = firstName(state.profile?.name) || firstName(state.user.name);
      nav.innerHTML = `
        <span class="text-[10px] font-bold uppercase tracking-[0.2em]">
          voce so precisa de um SIM${greetingName ? `, ${escapeHtml(greetingName)}` : ""}
        </span>
        <button data-action="logout" class="text-[10px] font-bold uppercase tracking-[0.2em] underline">
          Sair
        </button>
      `;
      return;
    }

    nav.innerHTML = `
      <button data-action="open-login" class="text-[10px] font-bold uppercase tracking-[0.2em] hover:underline transition-colors">
        Acessar
      </button>
    `;
  },

  /**
   * Sincroniza UI do filtro de período com o estado:
   * - Mostra/oculta #dateRange quando period === "custom"
   * - Mantém inputs de data com os valores do state
   */
  syncPeriodUI() {
    const periodEl = document.getElementById("periodFilter");
    const rangeEl = document.getElementById("dateRange");
    const fromEl = document.getElementById("dateFrom");
    const toEl = document.getElementById("dateTo");

    if (!state.filters) state.filters = {};
    if (!state.filters.period) state.filters.period = "all";
    if (typeof state.filters.dateFrom !== "string") state.filters.dateFrom = "";
    if (typeof state.filters.dateTo !== "string") state.filters.dateTo = "";

    // Se existir o select, refletir no estado
    if (periodEl) {
      state.filters.period = periodEl.value || "all";
    }

    const isCustom = state.filters.period === "custom";

    if (rangeEl) {
      rangeEl.classList.toggle("hidden", !isCustom);
    }

    // Garantir que inputs reflitam estado
    if (fromEl && fromEl.value !== (state.filters.dateFrom || "")) {
      fromEl.value = state.filters.dateFrom || "";
    }
    if (toEl && toEl.value !== (state.filters.dateTo || "")) {
      toEl.value = state.filters.dateTo || "";
    }
  },

  // --- Auth modal
  openAuthModal(type) {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;

    modal.classList.remove("hidden");
    ui.switchAuth(type);
    document.body.style.overflow = "hidden";
  },

  closeAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;

    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
  },

  switchAuth(type) {
    const title = document.getElementById("auth-title");
    const views = {
      login: { title: "Entrar.", form: "form-login" },
      register: { title: "Criar.", form: "form-register" },
      forgot: { title: "Recuperar.", form: "form-forgot-password" },
      reset: { title: "Nova senha.", form: "form-reset-password" },
    };
    const active = views[type] || views.login;

    if (title) title.innerText = active.title;
    Object.values(views).forEach(({ form }) => {
      document.getElementById(form)?.classList.toggle("hidden", form !== active.form);
    });
  },

  // --- Job modal
  openJobModal(job = null) {
    const form = document.getElementById("form-job");
    if (!form) return;

    form.reset();

    const idEl = document.getElementById("job-id");
    const titleEl = document.getElementById("job-modal-title");

    if (idEl) idEl.value = job?.id || "";
    if (titleEl) titleEl.innerText = job ? "Editar." : "Nova.";

    if (job) {
      const jt = document.getElementById("job-title");
      const jc = document.getElementById("job-company");
      const jl = document.getElementById("job-link");
      const jcv = document.getElementById("job-cv");

      if (jt) jt.value = job.titulo || "";
      if (jc) jc.value = job.empresa || "";
      if (jl) jl.value = job.linkVaga || "";
      if (jcv) jcv.value = job.linkCV || "";

      // API retorna ISO; input date precisa YYYY-MM-DD
      const jd = document.getElementById("job-date");
      if (jd) jd.value = ui.isoToDate(job.data);

      const js = document.getElementById("job-status-field");
      if (js) js.value = job.status || "Ativa";

      const jf = document.getElementById("job-fase-field");
      if (jf) jf.value = job.fase || "";

      const actionBool = document.getElementById("job-action-bool");
      if (actionBool) actionBool.checked = !!job.acaoNecessaria;

      const qualAcao = document.getElementById("job-qual-acao");
      if (qualAcao) qualAcao.value = job.qualAcao || "";

      const prazoAcao = document.getElementById("job-prazo-acao");
      if (prazoAcao) prazoAcao.value = job.prazoAcao ? ui.isoToDate(job.prazoAcao) : "";

      const feedbackBool = document.getElementById("job-feedback-bool");
      if (feedbackBool) feedbackBool.checked = !!job.feedbackBool;

      const feedbackTxt = document.getElementById("job-feedback-txt");
      if (feedbackTxt) feedbackTxt.value = job.feedbackTxt || "";
      const notes = document.getElementById("job-notes");
      if (notes) notes.value = job.notes || "";
    }

    ui.syncConditionalFields();

    const modal = document.getElementById("job-modal");
    if (modal) modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  closeJobModal() {
    const modal = document.getElementById("job-modal");
    if (!modal) return;

    modal.classList.add("hidden");
    document.body.style.overflow = "auto";
  },

  openApplicationForm(result) {
    const modal = document.getElementById("application-modal");
    const form = document.getElementById("form-application");
    if (!modal || !form) return;
    state.pendingApplicationAnalysis = result;
    form.reset();
    document.getElementById("application-analysis-id").value = result.analysisId;
    document.getElementById("application-link-vaga").value = result.linkVaga || "";
    const context = `${result.targetTitle}${result.selectedSubprofileName ? ` | ${result.selectedSubprofileName}` : ""} | ${result.score}%`;
    document.getElementById("application-form-context").textContent = context;
    form.classList.remove("hidden");
    modal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    ui.syncApplicationConditionalFields();
  },

  closeApplicationModal() {
    document.getElementById("application-modal")?.classList.add("hidden");
    state.pendingApplicationAnalysis = null;
    document.body.style.overflow = "auto";
  },

  syncApplicationConditionalFields() {
    const needsAction = !!document.getElementById("application-action-bool")?.checked;
    const hasFeedback = !!document.getElementById("application-feedback-bool")?.checked;
    document.getElementById("application-action-fields")?.classList.toggle("hidden", !needsAction);
    document.getElementById("application-feedback-fields")?.classList.toggle("hidden", !hasFeedback);
    const actionInput = document.getElementById("application-qual-acao");
    const feedbackInput = document.getElementById("application-feedback-txt");
    if (actionInput) actionInput.required = needsAction;
    if (feedbackInput) feedbackInput.required = hasFeedback;
  },

  syncConditionalFields() {
  const actionCheckbox = document.getElementById("job-action-bool");
  const feedbackCheckbox = document.getElementById("job-feedback-bool");

  const needsAction = actionCheckbox ? actionCheckbox.checked : false;
  const hasFeedback = feedbackCheckbox ? feedbackCheckbox.checked : false;

  const actionFields = document.getElementById("job-action-fields");
  if (actionFields) {
    actionFields.classList.toggle("hidden", !needsAction);
  }

  const feedbackFields = document.getElementById("job-feedback-fields");
  if (feedbackFields) {
    feedbackFields.classList.toggle("hidden", !hasFeedback);
  }
},


  renderJobs() {
    const list = document.getElementById("jobs-list");
    if (!list) return;

    if (!state.jobs || !state.jobs.length) {
      list.innerHTML = `
        <tr>
          <td colspan="4" class="jobs-empty py-8 sm:py-10 px-4 sm:px-6 text-sm text-taupe">
            Nenhum registro encontrado com os filtros atuais.
          </td>
        </tr>
      `;
      return;
    }

    list.innerHTML = state.jobs
      .map(
        (job) => `
      <tr class="group hover:bg-stone-50 transition-colors">
        <td data-label="Registro" class="py-5 sm:py-10 px-4 sm:px-6">
          <div class="font-bold text-lg sm:text-xl">${escapeHtml(job.titulo)}</div>
          <div class="text-[9px] uppercase tracking-[0.4em] text-stone mt-2 font-bold">${escapeHtml(job.empresa)}</div>
          ${job.jobAnalysis ? `<div class="text-xs text-taupe mt-3">Aderência: ${job.jobAnalysis.matchScore}% | Perfil: ${escapeHtml(job.jobAnalysis.selectedSubprofile?.profileName || "—")}</div>` : ""}
          ${job.jobAnalysis?.matchedSkills?.length ? `<div class="text-xs text-taupe mt-1">Skills: ${escapeHtml(job.jobAnalysis.matchedSkills.join(", "))}</div>` : ""}
          ${job.jobAnalysis?.missingSkills?.length ? `<div class="text-xs text-taupe mt-1">Ausentes: ${escapeHtml(job.jobAnalysis.missingSkills.join(", "))}</div>` : ""}
          ${Array.isArray(job.optimizedResume?.selectedProjects) && job.optimizedResume.selectedProjects.length ? `<div class="text-xs text-taupe mt-1">Projetos: ${escapeHtml(job.optimizedResume.selectedProjects.map((project) => project.title).filter(Boolean).join(", "))}</div>` : ""}
          <div class="flex flex-wrap gap-3 mt-3 text-[9px] font-bold uppercase tracking-widest">
            ${job.linkVaga ? `<a href="${escapeHtml(job.linkVaga)}" target="_blank" rel="noopener noreferrer" class="underline">Vaga</a>` : ""}
            ${job.linkCV ? `<a href="${escapeHtml(job.linkCV)}" target="_blank" rel="noopener noreferrer" class="underline">Link CV</a>` : ""}
          </div>
          ${job.acaoNecessaria ? `<div class="text-xs text-red-700 mt-1">Ação: ${escapeHtml(job.qualAcao || "pendente")}</div>` : ""}
          ${job.feedbackBool ? `<div class="text-xs text-taupe mt-1">Feedback: ${escapeHtml(job.feedbackTxt || "recebido")}</div>` : ""}
        </td>
        <td data-label="Estágio" class="py-4 sm:py-10 px-4 sm:px-6 text-[10px] font-bold uppercase tracking-widest">${escapeHtml(job.fase)}</td>
        <td data-label="Status" class="py-4 sm:py-10 px-4 sm:px-6 text-[10px] font-bold uppercase tracking-widest text-stone">${escapeHtml(job.status)}</td>
        <td data-label="Ações" class="job-actions py-4 sm:py-10 px-4 sm:px-6 text-right">
          <button data-action="edit" data-id="${job.id}" class="text-[9px] font-bold uppercase tracking-widest hover:underline">
            Editar
          </button>
          ${job.jobAnalysis ? `<button data-action="open-analysis" data-analysis-id="${job.jobAnalysis.id}" class="text-[9px] font-bold uppercase tracking-widest ml-6 hover:underline">Análise</button>` : ""}
          ${job.optimizedResume ? `<button data-action="download-optimized" data-resume-id="${job.optimizedResume.id}" class="text-[9px] font-bold uppercase tracking-widest ml-6 hover:underline">Currículo</button>` : ""}
          <button data-action="delete" data-id="${job.id}" class="text-[9px] font-bold uppercase tracking-widest text-red-700 ml-6 hover:underline">
            Remover
          </button>
        </td>
      </tr>
    `
      )
      .join("");
  },

  isoToDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  },

  notify(message, type = "success") {
    toast(message, type);
  },
};
