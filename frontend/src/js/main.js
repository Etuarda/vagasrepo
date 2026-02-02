import { state } from "./state.js";
import { ui } from "./ui.js";
import { auth } from "./auth.js";
import { jobs } from "./jobs.js";

function debounce(fn, wait = 300) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

let __vlibrasStarted = false;

function forceVlibrasZIndex() {
  // alguns CSS resets/layouts podem esconder o botão do plugin
  const btn = document.querySelector("[vw-access-button]");
  if (btn) {
    btn.style.zIndex = "99999";
    btn.style.position = "fixed";
  }

  const wrapper = document.querySelector("[vw-plugin-wrapper]");
  if (wrapper) {
    wrapper.style.zIndex = "99999";
  }
}

function safeInitVlibras() {
  if (__vlibrasStarted) return;

  // garante que o container existe no DOM
  const container = document.querySelector("[vw]");
  if (!container) return;

  try {
    if (window.VLibras && typeof window.VLibras.Widget === "function") {
      new window.VLibras.Widget("https://vlibras.gov.br/app");
      __vlibrasStarted = true;

      // dá um tempo pro plugin injetar os elementos e ajusta z-index
      setTimeout(forceVlibrasZIndex, 300);
      return;
    }
  } catch (err) {
    console.warn("VLibras falhou ao inicializar:", err);
  }
}

function wireEvents() {
  const navActions = document.getElementById("nav-actions");
  if (navActions) {
    navActions.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const action = btn.dataset.action;
      if (action === "logout") auth.logout();
      if (action === "open-login") ui.openAuthModal("login");
    });
  }

  const formLogin = document.getElementById("form-login");
  if (formLogin) {
    formLogin.addEventListener("submit", async (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email")?.value || "";
      const password = document.getElementById("login-password")?.value || "";
      await auth.login(email, password, () => jobs.load());
    });
  }

  const formRegister = document.getElementById("form-register");
  if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("reg-name")?.value || "";
      const email = document.getElementById("reg-email")?.value || "";
      const password = document.getElementById("reg-password")?.value || "";
      await auth.register(name, email, password);
    });
  }

  document.querySelectorAll("[data-open-auth]").forEach((el) => {
    el.addEventListener("click", () => ui.openAuthModal(el.dataset.openAuth));
  });

  const openJobBtn = document.querySelector("[data-open-job]");
  if (openJobBtn) openJobBtn.addEventListener("click", () => ui.openJobModal(null));

  const formJob = document.getElementById("form-job");
  if (formJob) {
    formJob.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        id: document.getElementById("job-id")?.value || null,
        titulo: document.getElementById("job-title")?.value || "",
        empresa: document.getElementById("job-company")?.value || "",
        linkVaga: document.getElementById("job-link")?.value || "",
        linkCV: document.getElementById("job-cv")?.value || "",
        data: document.getElementById("job-date")?.value || "",
        status: document.getElementById("job-status-field")?.value || "",
        fase: document.getElementById("job-fase-field")?.value || "",
        acaoNecessaria: !!document.getElementById("job-action-bool")?.checked,
        qualAcao: document.getElementById("job-qual-acao")?.value || "",
        prazoAcao: document.getElementById("job-prazo-acao")?.value || null,
        feedbackBool: !!document.getElementById("job-feedback-bool")?.checked,
        feedbackTxt: document.getElementById("job-feedback-txt")?.value || "",
      };

      await jobs.save(payload);
    });
  }

  const actionBool = document.getElementById("job-action-bool");
  if (actionBool) actionBool.addEventListener("change", ui.syncConditionalFields);

  const feedbackBool = document.getElementById("job-feedback-bool");
  if (feedbackBool) feedbackBool.addEventListener("change", ui.syncConditionalFields);

  document.querySelectorAll("[data-close-auth]").forEach((el) =>
    el.addEventListener("click", () => ui.closeAuthModal())
  );
  document.querySelectorAll("[data-close-job]").forEach((el) =>
    el.addEventListener("click", () => ui.closeJobModal())
  );

  const debouncedLoad = debounce(() => jobs.load(), 300);

  const filterQ = document.getElementById("filter-q");
  if (filterQ) {
    filterQ.addEventListener("input", (e) => {
      state.filters.q = e.target.value;
      debouncedLoad();
    });
  }

  const filterStatus = document.getElementById("filter-status");
  if (filterStatus) {
    filterStatus.addEventListener("change", (e) => {
      state.filters.status = e.target.value;
      jobs.load();
    });
  }

  const periodFilter = document.getElementById("periodFilter");
  if (periodFilter) {
    periodFilter.addEventListener("change", (e) => {
      state.filters.period = e.target.value || "all";
      ui.syncPeriodUI();
      jobs.load();
    });
  }

  const dateFrom = document.getElementById("dateFrom");
  if (dateFrom) {
    dateFrom.addEventListener("change", (e) => {
      state.filters.dateFrom = e.target.value || "";
      ui.syncPeriodUI();
      if (state.filters.period === "custom") jobs.load();
    });
  }

  const dateTo = document.getElementById("dateTo");
  if (dateTo) {
    dateTo.addEventListener("change", (e) => {
      state.filters.dateTo = e.target.value || "";
      ui.syncPeriodUI();
      if (state.filters.period === "custom") jobs.load();
    });
  }

  const exportBtn = document.getElementById("exportPdf");
  if (exportBtn) exportBtn.addEventListener("click", () => jobs.exportPdf());

  const jobsList = document.getElementById("jobs-list");
  if (jobsList) {
    jobsList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === "delete") return jobs.remove(id);
      if (action === "edit") {
        const job = (state.jobs || []).find((j) => j.id === id);
        return ui.openJobModal(job);
      }
    });
  }

  const toggleContrast = document.querySelector("[data-toggle-contrast]");
  if (toggleContrast) {
    toggleContrast.addEventListener("click", () => {
      ui.toggleContrast();
      safeInitVlibras(); // init também no clique
    });
  }

  if (typeof ui.syncPeriodUI === "function") ui.syncPeriodUI();
}

// DOMContentLoaded é mais seguro que load para o container [vw] já existir
document.addEventListener("DOMContentLoaded", () => {
  safeInitVlibras();
});

window.addEventListener("load", async () => {
  // tenta de novo no load (caso script demore)
  safeInitVlibras();

  if (localStorage.getItem("vagas_contrast") === "true") ui.toggleContrast();

  wireEvents();
  await auth.init(() => jobs.load());
});
