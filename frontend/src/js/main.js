import { state } from "./state.js";
import { ui } from "./ui.js";
import { auth } from "./auth.js";
import { jobs } from "./jobs.js";
import { career } from "./career.js";

function debounce(fn, wait = 300) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function runWithFeedback(button, options, action) {
  const target = button || null;
  if (target?.dataset?.busy === "true") return;

  const originalHtml = target?.innerHTML;
  const originalDisabled = target?.disabled;

  if (options.notice) ui.notify(options.notice, options.noticeType || "success");

  if (target) {
    target.dataset.busy = "true";
    target.setAttribute("aria-busy", "true");
    target.classList.add("opacity-60", "cursor-not-allowed");
    if ("disabled" in target) target.disabled = true;
    if (options.busyText) target.innerHTML = options.busyText;
  }

  try {
    return await action();
  } catch (err) {
    if (!err?.status) ui.notify(err?.message || "Nao foi possivel concluir a acao.", "error");
    return undefined;
  } finally {
    if (target) {
      if (originalHtml !== undefined) target.innerHTML = originalHtml;
      if ("disabled" in target) target.disabled = originalDisabled;
      target.classList.remove("opacity-60", "cursor-not-allowed");
      target.removeAttribute("aria-busy");
      delete target.dataset.busy;
    }
  }
}

function getSubmitButton(event, form) {
  return event.submitter || form?.querySelector('button[type="submit"], input[type="submit"]');
}

let __vlibrasStarted = false;

async function loadDashboardData() {
  await jobs.load();
  await career.loadProfiles();
  await career.loadProfile();
  await career.loadResumeFiles();
  await career.loadHistory();
}

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
      await runWithFeedback(
        getSubmitButton(e, formLogin),
        { busyText: "Entrando...", notice: "Validando acesso..." },
        async () => {
          const email = document.getElementById("login-email")?.value || "";
          const password = document.getElementById("login-password")?.value || "";
          await auth.login(email, password, loadDashboardData);
        }
      );
    });
  }

  const formRegister = document.getElementById("form-register");
  if (formRegister) {
    formRegister.addEventListener("submit", async (e) => {
      e.preventDefault();
      await runWithFeedback(
        getSubmitButton(e, formRegister),
        { busyText: "Criando...", notice: "Criando sua conta..." },
        async () => {
          const name = document.getElementById("reg-name")?.value || "";
          const email = document.getElementById("reg-email")?.value || "";
          const password = document.getElementById("reg-password")?.value || "";
          await auth.register(name, email, password);
        }
      );
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

      await runWithFeedback(
        getSubmitButton(e, formJob),
        { busyText: "Salvando...", notice: "Salvando candidatura..." },
        async () => {
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
        }
      );
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
  if (exportBtn) {
    exportBtn.addEventListener("click", async () => {
      await runWithFeedback(
        exportBtn,
        { busyText: "Gerando...", notice: "Gerando PDF das candidaturas..." },
        () => jobs.exportPdf()
      );
    });
  }

  document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
    button.addEventListener("click", () => career.setTab(button.dataset.dashboardTab));
  });

  const formProfile = document.getElementById("form-profile");
  if (formProfile) {
    formProfile.addEventListener("submit", async (e) => {
      e.preventDefault();
      await runWithFeedback(
        getSubmitButton(e, formProfile),
        { busyText: "Salvando...", notice: "Salvando perfil profissional..." },
        () => career.saveProfile()
      );
    });
  }

  const profileSelect = document.getElementById("career-profile-select");
  if (profileSelect) {
    profileSelect.addEventListener("change", async (e) => {
      await career.switchProfile(e.target.value);
    });
  }

  const formCreateProfile = document.getElementById("form-create-profile");
  if (formCreateProfile) {
    formCreateProfile.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("new-profile-name");
      const profileName = input?.value?.trim() || "";
      if (!profileName) {
        ui.notify("Informe um nome para o perfil.", "error");
        return;
      }
      await runWithFeedback(
        getSubmitButton(e, formCreateProfile),
        { busyText: "Criando...", notice: "Criando subperfil..." },
        async () => {
          await career.createProfile(profileName);
          input.value = "";
        }
      );
    });
  }

  const formSkill = document.getElementById("form-skill");
  if (formSkill) {
    formSkill.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("skill-name");
      const name = input?.value?.trim() || "";
      if (!name) return;
      await runWithFeedback(
        getSubmitButton(e, formSkill),
        { busyText: "Adicionando...", notice: "Adicionando habilidade..." },
        async () => {
          await career.addSkill(name);
          input.value = "";
        }
      );
    });
  }

  const skillsList = document.getElementById("skills-list");
  if (skillsList) {
    skillsList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-skill]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Removendo...", notice: "Removendo habilidade..." },
        () => career.removeSkill(btn.dataset.removeSkill)
      );
    });
  }

  const formLanguage = document.getElementById("form-language");
  if (formLanguage) {
    formLanguage.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("language-name")?.value?.trim() || "";
      const level = document.getElementById("language-level")?.value?.trim() || "";
      if (!name) return;
      await runWithFeedback(
        getSubmitButton(e, formLanguage),
        { busyText: "Salvando...", notice: "Salvando idioma..." },
        async () => {
          await career.addLanguage({ name, level });
          formLanguage.reset();
        }
      );
    });
  }

  const languagesList = document.getElementById("languages-list");
  if (languagesList) {
    languagesList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-language]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Removendo...", notice: "Removendo idioma..." },
        () => career.removeLanguage(btn.dataset.removeLanguage)
      );
    });
  }

  const formProject = document.getElementById("form-project");
  if (formProject) {
    formProject.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("project-title")?.value || "";
      const description = document.getElementById("project-description")?.value || "";
      const repositoryUrl = document.getElementById("project-repository-url")?.value || "";
      const deployUrl = document.getElementById("project-deploy-url")?.value || "";
      const technologies = (document.getElementById("project-techs")?.value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      await runWithFeedback(
        getSubmitButton(e, formProject),
        { busyText: "Salvando...", notice: "Salvando projeto..." },
        async () => {
          await career.addProject({ title, description, repositoryUrl, deployUrl, technologies });
          formProject.reset();
        }
      );
    });
  }

  const projectsList = document.getElementById("projects-list");
  if (projectsList) {
    projectsList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-project]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Removendo...", notice: "Removendo projeto..." },
        () => career.removeProject(btn.dataset.removeProject)
      );
    });
  }

  const formExperience = document.getElementById("form-experience");
  if (formExperience) {
    formExperience.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        company: document.getElementById("experience-company")?.value || "",
        role: document.getElementById("experience-role")?.value || "",
        period: document.getElementById("experience-period")?.value || "",
        description: document.getElementById("experience-description")?.value || "",
      };
      await runWithFeedback(
        getSubmitButton(e, formExperience),
        { busyText: "Salvando...", notice: "Salvando experiencia..." },
        async () => {
          await career.addExperience(payload);
          formExperience.reset();
        }
      );
    });
  }

  const experiencesList = document.getElementById("experiences-list");
  if (experiencesList) {
    experiencesList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-experience]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Removendo...", notice: "Removendo experiencia..." },
        () => career.removeExperience(btn.dataset.removeExperience)
      );
    });
  }

  const formCourse = document.getElementById("form-course");
  if (formCourse) {
    formCourse.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById("course-title")?.value || "",
        institution: document.getElementById("course-institution")?.value || "",
        period: document.getElementById("course-period")?.value || "",
        description: document.getElementById("course-description")?.value || "",
      };
      await runWithFeedback(
        getSubmitButton(e, formCourse),
        { busyText: "Salvando...", notice: "Salvando curso..." },
        async () => {
          await career.addCourse(payload);
          formCourse.reset();
        }
      );
    });
  }

  const coursesList = document.getElementById("courses-list");
  if (coursesList) {
    coursesList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-course]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Removendo...", notice: "Removendo curso..." },
        () => career.removeCourse(btn.dataset.removeCourse)
      );
    });
  }

  const formCertification = document.getElementById("form-certification");
  if (formCertification) {
    formCertification.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById("certification-title")?.value || "",
        issuer: document.getElementById("certification-issuer")?.value || "",
        period: document.getElementById("certification-period")?.value || "",
        credentialUrl: document.getElementById("certification-url")?.value || "",
      };
      await runWithFeedback(
        getSubmitButton(e, formCertification),
        { busyText: "Salvando...", notice: "Salvando certificacao..." },
        async () => {
          await career.addCertification(payload);
          formCertification.reset();
        }
      );
    });
  }

  const certificationsList = document.getElementById("certifications-list");
  if (certificationsList) {
    certificationsList.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-remove-certification]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Removendo...", notice: "Removendo certificacao..." },
        () => career.removeCertification(btn.dataset.removeCertification)
      );
    });
  }

  const formMatch = document.getElementById("form-match");
  if (formMatch) {
    formMatch.addEventListener("submit", async (e) => {
      e.preventDefault();
      const jobDescription = document.getElementById("match-job-description")?.value || "";
      await runWithFeedback(
        getSubmitButton(e, formMatch),
        {
          busyText: "Calculando...",
          notice: "Calculando aderencia e gerando curriculo otimizado...",
        },
        () => career.match(jobDescription)
      );
    });
  }

  const matchResult = document.getElementById("match-result");
  if (matchResult) {
    matchResult.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-download-current-optimized]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Baixando...", notice: "Preparando download do curriculo otimizado..." },
        () => career.downloadOptimizedResume(btn.dataset.downloadCurrentOptimized)
      );
    });
  }

  const formResumeUpload = document.getElementById("form-resume-upload");
  if (formResumeUpload) {
    formResumeUpload.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("resume-file-input");
      const file = input?.files?.[0];
      if (!file) {
        ui.notify("Selecione um PDF para anexar.", "error");
        return;
      }
      await runWithFeedback(
        getSubmitButton(e, formResumeUpload),
        {
          busyText: "Lendo PDF...",
          notice: "Curriculo recebido. Lendo PDF e preenchendo o perfil...",
        },
        async () => {
          await career.uploadResumeFile(file);
          input.value = "";
        }
      );
    });
  }

  const resumeFilesList = document.getElementById("resume-files-list");
  if (resumeFilesList) {
    resumeFilesList.addEventListener("click", async (e) => {
      const removeBtn = e.target.closest("[data-remove-resume]");
      if (removeBtn) {
        await runWithFeedback(
          removeBtn,
          { busyText: "Removendo...", notice: "Removendo curriculo do historico..." },
          () => career.removeResumeFile(removeBtn.dataset.removeResume)
        );
        return;
      }

      const downloadLink = e.target.closest("[data-download-resume]");
      if (downloadLink) {
        e.preventDefault();
        await runWithFeedback(
          downloadLink,
          { busyText: "Baixando...", notice: "Preparando download do PDF original..." },
          () => career.downloadResumeFile(downloadLink.dataset.downloadResume)
        );
      }
    });
  }

  const matchHistory = document.getElementById("match-history");
  if (matchHistory) {
    matchHistory.addEventListener("click", async (e) => {
      const optimizedLink = e.target.closest("[data-download-optimized]");
      if (optimizedLink) {
        e.preventDefault();
        await runWithFeedback(
          optimizedLink,
          { busyText: "Baixando...", notice: "Preparando download do curriculo otimizado..." },
          () => career.downloadOptimizedResume(optimizedLink.dataset.downloadOptimized)
        );
        return;
      }

      const downloadLink = e.target.closest("[data-download-resume]");
      if (downloadLink) {
        e.preventDefault();
        await runWithFeedback(
          downloadLink,
          { busyText: "Baixando...", notice: "Preparando download do PDF original..." },
          () => career.downloadResumeFile(downloadLink.dataset.downloadResume)
        );
        return;
      }

      const btn = e.target.closest("[data-remove-match]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Removendo...", notice: "Removendo analise do historico..." },
        () => career.removeMatch(btn.dataset.removeMatch)
      );
    });
  }

  const jobsList = document.getElementById("jobs-list");
  if (jobsList) {
    jobsList.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === "delete") {
        return runWithFeedback(
          btn,
          { busyText: "Removendo...", notice: "Removendo candidatura..." },
          () => jobs.remove(id)
        );
      }
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
  await auth.init(loadDashboardData);
});
