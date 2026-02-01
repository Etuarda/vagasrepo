import { state } from "./state.js";
import { ui } from "./ui.js";
import { auth } from "./auth.js";
import { jobs } from "./jobs.js";

function wireEvents() {
  // navbar actions (delegation)
  document.getElementById("nav-actions").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    if (action === "logout") auth.logout();
    if (action === "open-login") ui.openAuthModal("login");
  });

  // auth forms
  document.getElementById("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;
    await auth.login(email, password, () => jobs.load());
  });

  document.getElementById("form-register").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("reg-name").value;
    const email = document.getElementById("reg-email").value;
    const password = document.getElementById("reg-password").value;
    await auth.register(name, email, password);
  });

  // open register/login
  document.querySelectorAll("[data-open-auth]").forEach((el) => {
    el.addEventListener("click", () => ui.openAuthModal(el.dataset.openAuth));
  });

  // job modal open
  document.querySelector("[data-open-job]").addEventListener("click", () => ui.openJobModal(null));

  // job form submit
  document.getElementById("form-job").addEventListener("submit", async (e) => {
    e.preventDefault();

    const payload = {
      id: document.getElementById("job-id").value || null,
      titulo: document.getElementById("job-title").value,
      empresa: document.getElementById("job-company").value,
      linkVaga: document.getElementById("job-link").value,
      linkCV: document.getElementById("job-cv").value,
      data: document.getElementById("job-date").value,
      status: document.getElementById("job-status-field").value,
      fase: document.getElementById("job-fase-field").value,
      acaoNecessaria: document.getElementById("job-action-bool").checked,
      qualAcao: document.getElementById("job-qual-acao").value,
      prazoAcao: document.getElementById("job-prazo-acao").value || null,
      feedbackBool: document.getElementById("job-feedback-bool").checked,
      feedbackTxt: document.getElementById("job-feedback-txt").value,
    };

    await jobs.save(payload);
  });

  // conditional fields
  document.getElementById("job-action-bool").addEventListener("change", ui.syncConditionalFields);
  document.getElementById("job-feedback-bool").addEventListener("change", ui.syncConditionalFields);

  // close modals
  document.querySelectorAll("[data-close-auth]").forEach((el) =>
    el.addEventListener("click", () => ui.closeAuthModal())
  );
  document.querySelectorAll("[data-close-job]").forEach((el) =>
    el.addEventListener("click", () => ui.closeJobModal())
  );

  // filters
  document.getElementById("filter-q").addEventListener("input", (e) => {
    state.filters.q = e.target.value;
    jobs.load();
  });
  document.getElementById("filter-status").addEventListener("change", (e) => {
    state.filters.status = e.target.value;
    jobs.load();
  });
  document.getElementById("filter-fase").addEventListener("input", (e) => {
    state.filters.fase = e.target.value;
    jobs.load();
  });

  // table actions
  document.getElementById("jobs-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const action = btn.dataset.action;
    const id = btn.dataset.id;

    if (action === "delete") return jobs.remove(id);
    if (action === "edit") {
      const job = state.jobs.find((j) => j.id === id);
      return ui.openJobModal(job);
    }
  });

  // accessibility mode
  document.querySelector("[data-toggle-contrast]").addEventListener("click", ui.toggleContrast);
}

window.addEventListener("load", async () => {
  // VLibras
  // eslint-disable-next-line no-undef
  new window.VLibras.Widget("https://vlibras.gov.br/app");

  if (localStorage.getItem("vagas_contrast") === "true") ui.toggleContrast();

  wireEvents();
  await auth.init(() => jobs.load());
});
