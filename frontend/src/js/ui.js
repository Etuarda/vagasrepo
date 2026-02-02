import { state } from "./state.js";
import { toast } from "./toast.js";

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
    localStorage.setItem(
      "vagas_contrast",
      String(document.body.classList.contains("high-contrast"))
    );
  },

  renderNav() {
    const nav = document.getElementById("nav-actions");
    if (!nav) return;

    if (state.user) {
      nav.innerHTML = `
        <span class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
          voce so precisa de um SIM, ${state.user.name}
        </span>
        <button data-action="logout" class="text-[10px] font-bold uppercase tracking-[0.2em] underline">
          Sair
        </button>
      `;
      return;
    }

    nav.innerHTML = `
      <button data-action="open-login" class="text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-60 transition-colors">
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
    const isLogin = type === "login";

    const title = document.getElementById("auth-title");
    const formLogin = document.getElementById("form-login");
    const formRegister = document.getElementById("form-register");

    if (title) title.innerText = isLogin ? "Entrar." : "Criar.";
    if (formLogin) formLogin.classList.toggle("hidden", !isLogin);
    if (formRegister) formRegister.classList.toggle("hidden", isLogin);
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
          <td colspan="4" class="py-10 px-6 text-sm text-taupe">
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
        <td class="py-10 px-6">
          <div class="font-bold text-xl">${job.titulo}</div>
          <div class="text-[9px] uppercase tracking-[0.4em] text-stone mt-2 font-bold">${job.empresa}</div>
        </td>
        <td class="py-10 px-6 text-[10px] font-bold uppercase tracking-widest">${job.fase}</td>
        <td class="py-10 px-6 text-[10px] font-bold uppercase tracking-widest opacity-40">${job.status}</td>
        <td class="py-10 px-6 text-right">
          <button data-action="edit" data-id="${job.id}" class="text-[9px] font-bold uppercase tracking-widest hover:underline">
            Editar
          </button>
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
