import { state } from "./state.js";
import { ui } from "./ui.js";
import { auth } from "./auth.js";
import { jobs } from "./jobs.js";
import { career } from "./career.js";
import { billing } from "./billing.js";
import { support } from "./support.js";

async function runWithFeedback(button, options, action) {
  const target = button || null;
  if (target?.dataset?.busy === "true") return;

  const originalHtml = target?.innerHTML;
  const originalDisabled = target?.disabled;

  if (options.notice) ui.notify(options.notice, options.noticeType || "success");

  if (target) {
    target.dataset.busy = "true";
    target.setAttribute("aria-busy", "true");
    target.classList.add("is-busy", "cursor-not-allowed");
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
      target.classList.remove("is-busy", "cursor-not-allowed");
      target.removeAttribute("aria-busy");
      delete target.dataset.busy;
    }
  }
}

function getSubmitButton(event, form) {
  return event.submitter || form?.querySelector('button[type="submit"], input[type="submit"]');
}

function activeProfileName() {
  return (state.profiles || []).find((profile) => profile.id === state.activeProfileId)?.profileName
    || state.profile?.profileName
    || "";
}

let __vlibrasStarted = false;

async function loadDashboardData() {
  await Promise.all([jobs.load(), billing.load()]);
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
      if (action === "open-billing") {
        career.setTab("billing");
      }
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
          const phone = document.getElementById("reg-phone")?.value || "";
          const password = document.getElementById("reg-password")?.value || "";
          await auth.register(name, email, phone, password);
        }
      );
    });
  }

  const formForgotPassword = document.getElementById("form-forgot-password");
  if (formForgotPassword) {
    formForgotPassword.addEventListener("submit", async (e) => {
      e.preventDefault();
      await runWithFeedback(
        getSubmitButton(e, formForgotPassword),
        { busyText: "Enviando...", notice: "Solicitando recuperacao..." },
        () => auth.requestPasswordReset(document.getElementById("forgot-email")?.value || "")
      );
    });
  }

  const formResetPassword = document.getElementById("form-reset-password");
  if (formResetPassword) {
    formResetPassword.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("reset-password")?.value || "";
      const confirmation = document.getElementById("reset-password-confirm")?.value || "";
      if (password !== confirmation) {
        ui.notify("As senhas informadas nao coincidem.", "error");
        return;
      }
      await runWithFeedback(
        getSubmitButton(e, formResetPassword),
        { busyText: "Salvando...", notice: "Validando link de recuperacao..." },
        () => auth.resetPassword(document.getElementById("reset-token")?.value || "", password)
      );
    });
  }

  document.querySelectorAll("[data-open-auth]").forEach((el) => {
    el.addEventListener("click", () => {
      ui.openAuthModal(el.dataset.openAuth);
    });
  });
  document.querySelectorAll("[data-switch-auth]").forEach((el) => {
    el.addEventListener("click", () => ui.switchAuth(el.dataset.switchAuth));
  });

  const resetToken = new URLSearchParams(window.location.search).get("resetToken");
  if (resetToken) {
    const tokenInput = document.getElementById("reset-token");
    if (tokenInput) tokenInput.value = resetToken;
    ui.openAuthModal("reset");
  }

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
            notes: document.getElementById("job-notes")?.value || "",
          };

          await jobs.save(payload);
          const linkedAnalysis = payload.id && (state.jobs || []).find((job) => job.id === payload.id)?.jobAnalysis;
          if (linkedAnalysis) await career.refreshHistoryAfterTrackingChange();
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
  document.querySelectorAll("[data-close-application]").forEach((el) =>
    el.addEventListener("click", () => ui.closeApplicationModal())
  );
  document.querySelectorAll("[data-close-recalculate]").forEach((el) =>
    el.addEventListener("click", () => ui.closeRecalculateModal())
  );
  const applicationActionBool = document.getElementById("application-action-bool");
  if (applicationActionBool) applicationActionBool.addEventListener("change", ui.syncApplicationConditionalFields);
  const applicationFeedbackBool = document.getElementById("application-feedback-bool");
  if (applicationFeedbackBool) applicationFeedbackBool.addEventListener("change", ui.syncApplicationConditionalFields);
  const formApplication = document.getElementById("form-application");
  if (formApplication) {
    formApplication.addEventListener("submit", async (e) => {
      e.preventDefault();
      const analysisId = document.getElementById("application-analysis-id")?.value || "";
      const payload = {
        linkVaga: document.getElementById("application-link-vaga")?.value || "",
        linkCV: document.getElementById("application-link-cv")?.value || "",
        fase: document.getElementById("application-fase")?.value || "Currículo gerado",
        acaoNecessaria: !!document.getElementById("application-action-bool")?.checked,
        qualAcao: document.getElementById("application-qual-acao")?.value || "",
        prazoAcao: document.getElementById("application-prazo-acao")?.value || null,
        feedbackBool: !!document.getElementById("application-feedback-bool")?.checked,
        feedbackTxt: document.getElementById("application-feedback-txt")?.value || "",
        notes: document.getElementById("application-notes")?.value || "",
      };
      await runWithFeedback(
        getSubmitButton(e, formApplication),
        { busyText: "Salvando...", notice: "Registrando candidatura..." },
        () => career.createApplication(analysisId, payload)
      );
    });
  }

  const formRecalculate = document.getElementById("form-recalculate");
  if (formRecalculate) {
    formRecalculate.addEventListener("submit", async (e) => {
      e.preventDefault();
      const analysisId = document.getElementById("recalculate-analysis-id")?.value || "";
      const profileId = document.getElementById("recalculate-profile-id")?.value || "";
      await runWithFeedback(
        getSubmitButton(e, formRecalculate),
        { busyText: "Recalculando...", notice: "Criando nova versao da analise..." },
        () => career.recalculateAnalysis(analysisId, profileId)
      );
    });
  }
  const filterQ = document.getElementById("filter-q");
  if (filterQ) {
    filterQ.addEventListener("input", (e) => {
      state.filters.q = e.target.value;
    });
  }
  const bindFilterInput = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", (e) => {
      state.filters[key] = e.target.value;
    });
  };
  const bindFilterChange = (id, key) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", (e) => {
      state.filters[key] = e.target.value;
    });
  };
  bindFilterInput("filter-title", "titulo");
  bindFilterInput("filter-company", "empresa");
  bindFilterInput("filter-link", "linkVaga");
  bindFilterChange("filter-fase", "fase");
  bindFilterChange("filter-origin", "origin");
  bindFilterChange("filter-subprofile", "subprofileId");

  const filterStatus = document.getElementById("filter-status");
  if (filterStatus) {
    filterStatus.addEventListener("change", (e) => {
      state.filters.status = e.target.value;
    });
  }

  const periodFilter = document.getElementById("periodFilter");
  if (periodFilter) {
    periodFilter.addEventListener("change", (e) => {
      state.filters.period = e.target.value || "all";
      ui.syncPeriodUI();
    });
  }

  const dateFrom = document.getElementById("dateFrom");
  if (dateFrom) {
    dateFrom.addEventListener("change", (e) => {
      state.filters.dateFrom = e.target.value || "";
      ui.syncPeriodUI();
    });
  }

  const dateTo = document.getElementById("dateTo");
  if (dateTo) {
    dateTo.addEventListener("change", (e) => {
      state.filters.dateTo = e.target.value || "";
      ui.syncPeriodUI();
    });
  }

  const applyFilters = document.getElementById("applyFilters");
  if (applyFilters) {
    applyFilters.addEventListener("click", async () => {
      await runWithFeedback(
        applyFilters,
        { busyText: "Pesquisando...", notice: "Aplicando filtros..." },
        () => jobs.load()
      );
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

  const sharedJobsPeriod = document.getElementById("shared-jobs-period");
  if (sharedJobsPeriod) {
    sharedJobsPeriod.addEventListener("change", (e) => {
      state.sharedMatchedJobsPeriod = e.target.value || "month";
      career.loadSharedMatchedJobs();
    });
  }

  document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
    button.addEventListener("click", () => career.setTab(button.dataset.dashboardTab));
  });

  const billingCustomerForm = document.getElementById("form-billing-customer");
  if (billingCustomerForm) {
    billingCustomerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await runWithFeedback(
        getSubmitButton(e, billingCustomerForm),
        { busyText: "Salvando...", notice: "Salvando dados de cobranca..." },
        () => billing.saveCustomer({
            name: document.getElementById("billing-name")?.value || "",
            cpfCnpj: document.getElementById("billing-cpf-cnpj")?.value || "",
            email: document.getElementById("billing-email")?.value || "",
          })
      );
    });
  }

  const billingCheckoutForm = document.getElementById("form-billing-checkout");
  if (billingCheckoutForm) {
    billingCheckoutForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await runWithFeedback(
        getSubmitButton(e, billingCheckoutForm),
        { busyText: "Aguarde...", notice: "Iniciando pagamento seguro..." },
        () => billing.checkout(
          document.getElementById("billing-plan")?.value || "premium",
          document.getElementById("billing-coupon")?.value || ""
        )
      );
    });
  }

  billing.initPixCopyEvent();
  support.init();

  document.querySelectorAll("[data-cancel-edit]").forEach((button) => {
    button.addEventListener("click", () => career.cancelEdit(button.dataset.cancelEdit));
  });

  const formProfile = document.getElementById("form-profile");
  const profileSummary = document.getElementById("profile-summary");
  if (profileSummary) {
    profileSummary.addEventListener("input", () => {
      const counter = document.getElementById("profile-summary-counter");
      if (counter) counter.textContent = `${profileSummary.value.length}/3000 caracteres`;
    });
  }
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

  const profileCards = document.getElementById("career-profile-cards");
  if (profileCards) {
    profileCards.addEventListener("click", async (e) => {
      const remove = e.target.closest("[data-delete-profile]");
      if (remove) {
        const name = remove.dataset.profileName || "este subperfil";
        if (!window.confirm(`Apagar o subperfil "${name}"? Os dados específicos deste subperfil serão removidos.`)) return;
        await runWithFeedback(
          remove,
          { busyText: "...", notice: "Removendo subperfil..." },
          () => career.deleteProfile(remove.dataset.deleteProfile)
        );
        return;
      }
      const select = e.target.closest("[data-select-profile]");
      if (select) await career.switchProfile(select.dataset.selectProfile);
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
          await billing.load();
          input.value = "";
        }
      );
    });
  }

  const formAllocation = document.getElementById("form-subprofile-allocation");
  if (formAllocation) {
    formAllocation.addEventListener("submit", async (e) => {
      e.preventDefault();
      const selected = (field) => [...formAllocation.querySelectorAll(`[name="allocation-${field}"]:checked`)].map((item) => item.value);
      const payload = {
        projectIds: selected("projectIds"),
        experienceIds: selected("experienceIds"),
        courseIds: selected("courseIds"),
        certificationIds: selected("certificationIds"),
        educationIds: selected("educationIds"),
        languageIds: selected("languageIds"),
        copyBaseProfile: document.getElementById("allocation-copy-base")?.checked === true,
      };
      await runWithFeedback(
        getSubmitButton(e, formAllocation),
        { busyText: "Salvando...", notice: "Salvando itens do subperfil..." },
        () => career.saveAllocation(payload)
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

  const skillPresets = document.getElementById("skill-presets");
  if (skillPresets) {
    skillPresets.addEventListener("click", async (e) => {
      const btn = e.target.closest("[data-add-skill-preset]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "...", notice: "Adicionando habilidade selecionada..." },
        () => career.addSkill(btn.dataset.addSkillPreset)
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
          if (formLanguage.dataset.editId) await career.updateLanguage(formLanguage.dataset.editId, { name, level });
          else await career.addLanguage({ name, level });
          career.cancelEdit("language");
        }
      );
    });
  }

  const languagesList = document.getElementById("languages-list");
  if (languagesList) {
    languagesList.addEventListener("click", async (e) => {
      const edit = e.target.closest("[data-edit-language]");
      if (edit) return career.beginEdit("language", edit.dataset.editLanguage);
      const btn = e.target.closest("[data-remove-language]");
      if (!btn) return;
      await runWithFeedback(
        btn,
        { busyText: "Removendo...", notice: "Removendo idioma..." },
        () => career.removeLanguage(btn.dataset.removeLanguage)
      );
    });
  }

  const formEducation = document.getElementById("form-education");
  if (formEducation) {
    formEducation.addEventListener("submit", async (e) => {
      e.preventDefault();
      const payload = {
        title: document.getElementById("education-title-field")?.value || "",
        institution: document.getElementById("education-institution")?.value || "",
        period: document.getElementById("education-period")?.value || "",
        learnedSkills: document.getElementById("education-learned-skills")?.value || "",
      };
      await runWithFeedback(
        getSubmitButton(e, formEducation),
        { busyText: "Salvando...", notice: "Salvando formação..." },
        async () => {
          if (formEducation.dataset.editId) await career.updateEducation(formEducation.dataset.editId, payload);
          else await career.addEducation(payload);
          career.cancelEdit("education");
        }
      );
    });
  }

  const educationsList = document.getElementById("educations-list");
  if (educationsList) {
    educationsList.addEventListener("click", async (e) => {
      const edit = e.target.closest("[data-edit-education]");
      if (edit) return career.beginEdit("education", edit.dataset.editEducation);
      const btn = e.target.closest("[data-remove-education]");
      if (!btn) return;
      await runWithFeedback(btn, { busyText: "Removendo...", notice: "Removendo formação..." }, () => career.removeEducation(btn.dataset.removeEducation));
    });
  }

  const formProject = document.getElementById("form-project");
  if (formProject) {
    formProject.addEventListener("submit", async (e) => {
      e.preventDefault();
      const title = document.getElementById("project-title")?.value || "";
      const repositoryUrl = document.getElementById("project-repository-url")?.value || "";
      const deployUrl = document.getElementById("project-deploy-url")?.value || "";
      const category = "other";
      const shortDescription = document.getElementById("project-short-description")?.value || "";
      const learnedSkills = document.getElementById("project-learned-skills")?.value || "";

      await runWithFeedback(
        getSubmitButton(e, formProject),
        { busyText: "Salvando...", notice: "Salvando projeto..." },
        async () => {
          const payload = { title, category, shortDescription, learnedSkills, repositoryUrl, deployUrl };
          if (formProject.dataset.editId) await career.updateProject(formProject.dataset.editId, payload);
          else await career.addProject(payload);
          career.cancelEdit("project");
        }
      );
    });
  }

  const projectsList = document.getElementById("projects-list");
  if (projectsList) {
    projectsList.addEventListener("click", async (e) => {
      const editProject = e.target.closest("[data-edit-project]");
      if (editProject) return career.beginEdit("project", editProject.dataset.editProject);
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
        workload: document.getElementById("experience-workload")?.value || "",
        description: document.getElementById("experience-description")?.value || "",
      };
      await runWithFeedback(
        getSubmitButton(e, formExperience),
        { busyText: "Salvando...", notice: "Salvando experiencia..." },
        async () => {
          if (formExperience.dataset.editId) await career.updateExperience(formExperience.dataset.editId, payload);
          else await career.addExperience(payload);
          career.cancelEdit("experience");
        }
      );
    });
  }

  const experiencesList = document.getElementById("experiences-list");
  if (experiencesList) {
    experiencesList.addEventListener("click", async (e) => {
      const edit = e.target.closest("[data-edit-experience]");
      if (edit) return career.beginEdit("experience", edit.dataset.editExperience);
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
        workload: document.getElementById("course-workload")?.value || "",
        description: document.getElementById("course-description")?.value || "",
        learnedSkills: document.getElementById("course-learned-skills")?.value || "",
      };
      await runWithFeedback(
        getSubmitButton(e, formCourse),
        { busyText: "Salvando...", notice: "Salvando curso..." },
        async () => {
          if (formCourse.dataset.editId) await career.updateCourse(formCourse.dataset.editId, payload);
          else await career.addCourse(payload);
          career.cancelEdit("course");
        }
      );
    });
  }

  const coursesList = document.getElementById("courses-list");
  if (coursesList) {
    coursesList.addEventListener("click", async (e) => {
      const edit = e.target.closest("[data-edit-course]");
      if (edit) return career.beginEdit("course", edit.dataset.editCourse);
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
        workload: document.getElementById("certification-workload")?.value || "",
        credentialUrl: document.getElementById("certification-url")?.value || "",
        learnedSkills: document.getElementById("certification-learned-skills")?.value || "",
      };
      await runWithFeedback(
        getSubmitButton(e, formCertification),
        { busyText: "Salvando...", notice: "Salvando certificacao..." },
        async () => {
          if (formCertification.dataset.editId) await career.updateCertification(formCertification.dataset.editId, payload);
          else await career.addCertification(payload);
          career.cancelEdit("certification");
        }
      );
    });
  }

  const certificationsList = document.getElementById("certifications-list");
  if (certificationsList) {
    certificationsList.addEventListener("click", async (e) => {
      const edit = e.target.closest("[data-edit-certification]");
      if (edit) return career.beginEdit("certification", edit.dataset.editCertification);
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
    matchResult.addEventListener("submit", async (e) => {
      const form = e.target.closest("[data-analysis-edit-form]");
      if (!form) return;
      e.preventDefault();
      const payload = {
        jobTitle: form.elements.jobTitle.value,
        company: form.elements.company.value,
        linkVaga: form.elements.linkVaga.value,
        jobDescription: form.elements.jobDescription.value,
        notes: form.elements.notes.value,
        status: form.elements.status.value,
      };
      await runWithFeedback(
        form.querySelector("button[type='submit']"),
        { busyText: "Salvando...", notice: "Criando versão da análise..." },
        () => career.saveAnalysisVersion(form.dataset.analysisEditForm, payload)
      );
    });
    matchResult.addEventListener("click", async (e) => {
      const newMatchingBtn = e.target.closest("[data-new-matching]");
      if (newMatchingBtn) {
        career.newMatching();
        return;
      }
      const recalculateBtn = e.target.closest("[data-recalculate-analysis]");
      if (recalculateBtn) {
        ui.openRecalculateModal(state.lastMatchResult || { analysisId: recalculateBtn.dataset.recalculateAnalysis });
        return;
      }
      const registrationBtn = e.target.closest("[data-register-application]");
      if (registrationBtn) {
        ui.openApplicationForm(state.lastMatchResult || {
          analysisId: registrationBtn.dataset.registerApplication,
          targetTitle: "Vaga analisada",
          selectedSubprofileName: activeProfileName(),
          score: 0,
        });
        return;
      }
      const linkedJobBtn = e.target.closest("[data-open-analysis-job]");
      if (linkedJobBtn) {
        return jobs.open(linkedJobBtn.dataset.openAnalysisJob);
      }
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
          busyText: "Anexando...",
          notice: "Armazenando PDF apenas como referência...",
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

      const viewLink = e.target.closest("[data-view-resume]");
      if (viewLink) {
        e.preventDefault();
        await career.viewResumeFile(viewLink.dataset.viewResume);
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
      const openBtn = e.target.closest("[data-open-analysis]");
      if (openBtn) {
        return career.openAnalysis(openBtn.dataset.openAnalysis);
      }
      const linkedJobBtn = e.target.closest("[data-open-linked-job]");
      if (linkedJobBtn) {
        return jobs.open(linkedJobBtn.dataset.openLinkedJob);
      }
      const registerBtn = e.target.closest("[data-register-history-application]");
      if (registerBtn) {
        const analysis = (state.matchHistory || []).find((item) => item.analysisId === registerBtn.dataset.registerHistoryApplication);
        ui.openApplicationForm({
          analysisId: registerBtn.dataset.registerHistoryApplication,
          targetTitle: analysis?.targetTitle || "Vaga analisada",
          selectedSubprofileName: activeProfileName(),
          score: analysis?.score || 0,
          linkVaga: analysis?.linkVaga || "",
        });
        return;
      }
      const appliedBtn = e.target.closest("[data-mark-applied]");
      if (appliedBtn) {
        return runWithFeedback(
          appliedBtn,
          { busyText: "Salvando...", notice: "Registrando aplicacao..." },
          () => career.markAnalysisApplied(appliedBtn.dataset.markApplied)
        );
      }
      const recalculateBtn = e.target.closest("[data-recalculate-analysis]");
      if (recalculateBtn) {
        const analysis = (state.matchHistory || []).find((item) => item.analysisId === recalculateBtn.dataset.recalculateAnalysis);
        ui.openRecalculateModal(analysis || { analysisId: recalculateBtn.dataset.recalculateAnalysis });
        return;
      }
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

      const loadMoreBtn = e.target.closest("#match-history-load-more");
      if (loadMoreBtn) {
        await runWithFeedback(
          loadMoreBtn,
          { busyText: "Carregando...", notice: "Carregando mais analises..." },
          () => career.loadHistory({ announce: true, append: true, successMessage: "Mais itens carregados." })
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
          async () => {
            const linkedAnalysis = (state.jobs || []).find((job) => job.id === id)?.jobAnalysis;
            const removed = await jobs.remove(id);
            if (removed && linkedAnalysis) await career.refreshHistoryAfterTrackingChange();
          }
        );
      }
      if (action === "edit") {
        const job = (state.jobs || []).find((j) => j.id === id);
        return ui.openJobModal(job);
      }
      if (action === "open-analysis") {
        career.setTab("matching");
        return career.openAnalysis(btn.dataset.analysisId);
      }
      if (action === "download-optimized") {
        return career.downloadOptimizedResume(btn.dataset.resumeId);
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
document.addEventListener("DOMContentLoaded", async () => {
  safeInitVlibras();

  if (localStorage.getItem("vagas_contrast") === "true") ui.toggleContrast();

  wireEvents();
  await auth.init(loadDashboardData);
});
