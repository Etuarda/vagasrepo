import { state } from "./state.js";
import { toast } from "./toast.js";

export const ui = {
  navigate(view) {
    ["landing", "dashboard"].forEach((v) =>
      document.getElementById(`view-${v}`).classList.add("hidden")
    );
    document.getElementById(`view-${view}`).classList.remove("hidden");
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
    if (state.user) {
      nav.innerHTML = `
        <span class="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40"> voce so precisa de um SIM, ${state.user.name}</span>
        <button data-action="logout" class="text-[10px] font-bold uppercase tracking-[0.2em] underline">Sair</button>
      `;
    } else {
      nav.innerHTML = `
        <button data-action="open-login" class="text-[10px] font-bold uppercase tracking-[0.2em] hover:opacity-60 transition-colors">Acessar</button>
      `;
    }
  },

  // --- Auth modal
  openAuthModal(type) {
    document.getElementById("auth-modal").classList.remove("hidden");
    ui.switchAuth(type);
    document.body.style.overflow = "hidden";
  },

  closeAuthModal() {
    document.getElementById("auth-modal").classList.add("hidden");
    document.body.style.overflow = "auto";
  },

  switchAuth(type) {
    const isLogin = type === "login";
    document.getElementById("auth-title").innerText = isLogin ? "Entrar." : "Criar.";
    document.getElementById("form-login").classList.toggle("hidden", !isLogin);
    document.getElementById("form-register").classList.toggle("hidden", isLogin);
  },

  // --- Job modal
  openJobModal(job = null) {
    const form = document.getElementById("form-job");
    form.reset();

    document.getElementById("job-id").value = job?.id || "";
    document.getElementById("job-modal-title").innerText = job ? "Editar." : "Nova.";

    if (job) {
      document.getElementById("job-title").value = job.titulo;
      document.getElementById("job-company").value = job.empresa;
      document.getElementById("job-link").value = job.linkVaga;
      document.getElementById("job-cv").value = job.linkCV;

      // API retorna ISO; input date precisa YYYY-MM-DD
      document.getElementById("job-date").value = ui.isoToDate(job.data);

      document.getElementById("job-status-field").value = job.status;
      document.getElementById("job-fase-field").value = job.fase;

      document.getElementById("job-action-bool").checked = !!job.acaoNecessaria;
      document.getElementById("job-qual-acao").value = job.qualAcao || "";
      document.getElementById("job-prazo-acao").value = job.prazoAcao ? ui.isoToDate(job.prazoAcao) : "";

      document.getElementById("job-feedback-bool").checked = !!job.feedbackBool;
      document.getElementById("job-feedback-txt").value = job.feedbackTxt || "";
    }

    ui.syncConditionalFields();

    document.getElementById("job-modal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
  },

  closeJobModal() {
    document.getElementById("job-modal").classList.add("hidden");
    document.body.style.overflow = "auto";
  },

  syncConditionalFields() {
    const needsAction = document.getElementById("job-action-bool").checked;
    document.getElementById("job-action-fields").classList.toggle("hidden", !needsAction);

    const hasFeedback = document.getElementById("job-feedback-bool").checked;
    document.getElementById("job-feedback-fields").classList.toggle("hidden", !hasFeedback);
  },

  renderJobs() {
    const list = document.getElementById("jobs-list");
    if (!state.jobs.length) {
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
          <button data-action="edit" data-id="${job.id}" class="text-[9px] font-bold uppercase tracking-widest hover:underline">Editar</button>
          <button data-action="delete" data-id="${job.id}" class="text-[9px] font-bold uppercase tracking-widest text-red-700 ml-6 hover:underline">Remover</button>
        </td>
      </tr>
    `
      )
      .join("");
  },

  isoToDate(value) {
    // aceita Date ISO string
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
