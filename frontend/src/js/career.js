import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";
import { jobs } from "./jobs.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

let activeProfileRequestId = 0;
const loadStatusTimers = new Map();
const PROFILE_CLIENT_CACHE_MS = 5 * 60 * 1000;
const profileCache = new Map();
const profileRequests = new Map();
let profileRevision = 0;
const HISTORY_CLIENT_CACHE_MS = 2 * 60 * 1000;
const historyCache = new Map();
const historyRequests = new Map();
let historyRevision = 0;
const RESUME_FILES_CLIENT_CACHE_MS = 5 * 60 * 1000;
const resumeFilesCache = new Map();
const resumeFilesRequests = new Map();
let resumeFilesRevision = 0;
let profilesRequest = null;

function profileLabel(profileId) {
  return (state.profiles || []).find((profile) => profile.id === profileId)?.profileName || "perfil selecionado";
}

function profileCacheKey(profileId) {
  return `${state.user?.id || "guest"}:${profileId || "default"}`;
}

function showProfile(profile) {
  const requiresRender = state.profile !== profile || state.activeProfileId !== profile.id;
  state.profile = profile;
  state.activeProfileId = profile.id;
  if (requiresRender) {
    renderProfileForm();
    ui.renderNav();
  }
}

function replaceEditedProfile(profile) {
  profileRevision += 1;
  profileCache.clear();
  profileRequests.clear();
  profileCache.set(profileCacheKey(profile.id), { profile, savedAt: Date.now() });
  showProfile(profile);
}

function historyCacheKey(profileId) {
  return `${state.user?.id || "guest"}:${profileId || "default"}`;
}

function invalidateHistoryCache() {
  historyRevision += 1;
  historyCache.clear();
}

function resumeFilesCacheKey(profileId) {
  return `${state.user?.id || "guest"}:${profileId || "default"}`;
}

function invalidateResumeFilesCache() {
  resumeFilesRevision += 1;
  resumeFilesCache.clear();
}

async function prefetchWithLimit(items, worker, limit = 2) {
  const queue = [...items];
  const runners = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      try {
        await worker(item);
      } catch (err) {
        // Navigation remains available even when a background preload fails.
      }
    }
  });
  await Promise.all(runners);
}

function setLoadStatus(id, message, status, hideAfter = 0) {
  const root = document.getElementById(id);
  if (!root) return;

  window.clearTimeout(loadStatusTimers.get(id));
  root.textContent = message;
  root.classList.remove("hidden", "is-loading", "is-loaded", "is-error");
  root.classList.add(`is-${status}`);

  if (hideAfter) {
    loadStatusTimers.set(id, window.setTimeout(() => root.classList.add("hidden"), hideAfter));
  }
}

function isCurrentProfileRequest(requestId, profileId) {
  if (profileId !== state.activeProfileId) return false;
  return !requestId || requestId === activeProfileRequestId;
}

function setEditMode(type, id) {
  const form = document.getElementById(`form-${type}`);
  if (!form) return;
  form.dataset.editId = id;
  const submit = form.querySelector("[data-submit-label]");
  if (submit) submit.textContent = "Salvar alteracoes";
  form.querySelector(`[data-cancel-edit="${type}"]`)?.classList.remove("hidden");
}

function clearEditMode(type) {
  const form = document.getElementById(`form-${type}`);
  if (!form) return;
  delete form.dataset.editId;
  form.reset();
  const submit = form.querySelector("[data-submit-label]");
  if (submit) submit.textContent = submit.dataset.submitLabel;
  form.querySelector(`[data-cancel-edit="${type}"]`)?.classList.add("hidden");
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";
  return date.toLocaleString("pt-BR");
}

function renderSkills() {
  const root = document.getElementById("skills-list");
  if (!root) return;

  const skills = state.profile?.skills || [];
  if (!skills.length) {
    root.innerHTML = `<p class="text-sm text-taupe">Nenhuma habilidade cadastrada.</p>`;
    return;
  }

  root.innerHTML = skills
    .map(
      (skill) => `
        <span class="tag-pill contrast-chip">
          ${escapeHtml(skill)}
          <button type="button" data-remove-skill="${escapeHtml(skill)}" aria-label="Remover ${escapeHtml(skill)}">x</button>
        </span>
      `
    )
    .join("");
}

function renderLanguages() {
  const root = document.getElementById("languages-list");
  if (!root) return;

  const languages = state.profile?.languages || [];
  if (!languages.length) {
    root.innerHTML = `<p class="text-sm text-taupe">Nenhum idioma cadastrado.</p>`;
    return;
  }

  root.innerHTML = languages
    .map(
      (language) => `
        <span class="tag-pill contrast-chip">
          ${escapeHtml([language.name, language.level].filter(Boolean).join(" - "))}
          <button type="button" data-edit-language="${escapeHtml(language.id)}" aria-label="Editar ${escapeHtml(language.name)}">editar</button>
          <button type="button" data-remove-language="${escapeHtml(language.id)}" aria-label="Remover ${escapeHtml(language.name)}">x</button>
        </span>
      `
    )
    .join("");
}

function renderProjects() {
  const root = document.getElementById("projects-list");
  if (!root) return;

  const projects = state.profile?.projects || [];
  if (!projects.length) {
    root.innerHTML = `<p class="text-sm text-taupe">Nenhum projeto cadastrado.</p>`;
    return;
  }

  root.innerHTML = projects
    .map(
      (project) => `
        <article class="contrast-surface border border-borderLight rounded-2xl p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h4 class="font-serif text-2xl">${escapeHtml(project.title)}</h4>
              <p class="text-[10px] uppercase tracking-[0.25em] text-stone mt-1">${escapeHtml(project.category || "other")}</p>
              <p class="text-sm text-taupe mt-2 leading-relaxed">${escapeHtml(project.shortDescription)}</p>
              ${project.stack ? `<p class="text-xs text-stone mt-2">Stack: ${escapeHtml(project.stack)}</p>` : ""}
              ${project.learnedSkills?.length ? `<p class="text-xs text-stone mt-2">Habilidades aprendidas: ${escapeHtml(project.learnedSkills.join(", "))}</p>` : ""}
              <div class="flex flex-wrap gap-4 mt-3">
                ${project.repositoryUrl ? `<a href="${escapeHtml(project.repositoryUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs text-[#0563C1] underline break-all">${escapeHtml(project.repositoryUrl)}</a>` : ""}
                ${project.deployUrl ? `<a href="${escapeHtml(project.deployUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs text-[#0563C1] underline break-all">${escapeHtml(project.deployUrl)}</a>` : ""}
              </div>
            </div>
            <div class="flex gap-3">
              <button type="button" data-edit-project="${project.id}" class="text-[10px] font-bold uppercase tracking-widest">Editar</button>
              <button type="button" data-remove-project="${project.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
            </div>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSubprofileAllocation() {
  const section = document.getElementById("subprofile-allocation");
  const root = document.getElementById("subprofile-allocation-lists");
  const profile = state.profile;
  if (!section || !root || !profile || profile.isGlobal || !profile.globalCatalog) {
    section?.classList.add("hidden");
    return;
  }
  const groups = [
    ["skillIds", "Habilidades", "skills", (item) => item.name],
    ["projectIds", "Projetos", "projects", (item) => item.title],
    ["experienceIds", "Experiências", "experiences", (item) => `${item.role} | ${item.company}`],
    ["educationIds", "Formação", "educations", (item) => `${item.title} | ${item.institution}`],
    ["courseIds", "Cursos", "courses", (item) => item.title],
    ["certificationIds", "Certificações", "certifications", (item) => item.title],
    ["languageIds", "Idiomas", "languages", (item) => `${item.name}${item.level ? ` - ${item.level}` : ""}`],
  ];
  root.innerHTML = groups.map(([field, title, key, label]) => {
    const items = profile.globalCatalog[key] || [];
    return `
      <fieldset class="border border-borderLight rounded-xl p-4 space-y-2">
        <legend class="px-2 text-[10px] font-bold uppercase tracking-widest text-stone">${escapeHtml(title)}</legend>
        ${items.length ? items.map((item) => `
          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" name="allocation-${field}" value="${escapeHtml(item.id)}" ${item.selected ? "checked" : ""} />
            <span>${escapeHtml(label(item))}</span>
          </label>
        `).join("") : `<p class="text-xs text-taupe">Nenhum item global cadastrado.</p>`}
      </fieldset>
    `;
  }).join("");
  document.getElementById("allocation-copy-base").checked = false;
  section.classList.remove("hidden");
}

function renderEducations() {
  const root = document.getElementById("educations-list");
  if (!root) return;
  const items = state.profile?.educations || [];
  root.innerHTML = items.length ? items.map((item) => `
    <article class="contrast-surface border border-borderLight rounded-2xl p-4 flex justify-between gap-3">
      <p class="text-sm"><strong>${escapeHtml(item.title)}</strong> | ${escapeHtml(item.institution)}${item.period ? ` | ${escapeHtml(item.period)}` : ""}${item.learnedSkills?.length ? ` | Skills: ${escapeHtml(item.learnedSkills.join(", "))}` : ""}</p>
      ${state.profile?.isGlobal ? `<div class="flex gap-3"><button type="button" data-edit-education="${item.id}" class="text-[10px] font-bold uppercase">Editar</button><button type="button" data-remove-education="${item.id}" class="text-[10px] font-bold uppercase text-red-700">Remover</button></div>` : ""}
    </article>`).join("") : `<p class="text-sm text-taupe">Nenhuma formação cadastrada.</p>`;
}

function renderExperiences() {
  const root = document.getElementById("experiences-list");
  if (!root) return;

  const experiences = state.profile?.experiences || [];
  if (!experiences.length) {
    root.innerHTML = `<p class="text-sm text-taupe">Nenhuma experiência cadastrada.</p>`;
    return;
  }

  root.innerHTML = experiences
    .map(
      (experience) => `
        <article class="contrast-surface border border-borderLight rounded-2xl p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h4 class="font-bold">${escapeHtml(experience.role)}</h4>
              <p class="text-[10px] uppercase tracking-[0.25em] text-stone mt-1">${escapeHtml(experience.company)} | ${escapeHtml(experience.period)}${experience.workload ? ` | ${escapeHtml(experience.workload)}` : ""}</p>
            </div>
            <div class="flex gap-3">
              <button type="button" data-edit-experience="${experience.id}" class="text-[10px] font-bold uppercase tracking-widest">Editar</button>
              <button type="button" data-remove-experience="${experience.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
            </div>
          </div>
          <p class="text-sm text-taupe mt-3 leading-relaxed">${escapeHtml(experience.description)}</p>
        </article>
      `
    )
    .join("");
}

function renderCoursesAndCertifications() {
  const coursesRoot = document.getElementById("courses-list");
  const certsRoot = document.getElementById("certifications-list");

  if (coursesRoot) {
    const courses = state.profile?.courses || [];
    coursesRoot.innerHTML = courses.length
      ? courses
          .map(
            (course) => `
              <article class="contrast-surface border border-borderLight rounded-2xl p-5">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h4 class="font-bold">${escapeHtml(course.title)}</h4>
                    <p class="text-[10px] uppercase tracking-[0.25em] text-stone mt-1">${escapeHtml(course.institution || "Instituição não informada")} ${course.period ? ` | ${escapeHtml(course.period)}` : ""}${course.workload ? ` | Duração: ${escapeHtml(course.workload)}` : ""}</p>
                    ${course.learnedSkills?.length ? `<p class="text-xs text-stone mt-2">Habilidades aprendidas: ${escapeHtml(course.learnedSkills.join(", "))}</p>` : ""}
                    ${course.description ? `<p class="text-sm text-taupe mt-3">${escapeHtml(course.description)}</p>` : ""}
                  </div>
                  <div class="flex gap-3"><button type="button" data-edit-course="${course.id}" class="text-[10px] font-bold uppercase tracking-widest">Editar</button><button type="button" data-remove-course="${course.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button></div>
                </div>
              </article>
            `
          )
          .join("")
      : `<p class="text-sm text-taupe">Nenhum curso cadastrado.</p>`;
  }

  if (certsRoot) {
    const certifications = state.profile?.certifications || [];
    certsRoot.innerHTML = certifications.length
      ? certifications
          .map(
            (certification) => `
              <article class="contrast-surface border border-borderLight rounded-2xl p-5">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h4 class="font-bold">${escapeHtml(certification.title)}</h4>
                    <p class="text-[10px] uppercase tracking-[0.25em] text-stone mt-1">${escapeHtml(certification.issuer || "Emissor não informado")} ${certification.period ? ` | ${escapeHtml(certification.period)}` : ""}${certification.workload ? ` | Duração: ${escapeHtml(certification.workload)}` : ""}</p>
                    ${certification.learnedSkills?.length ? `<p class="text-xs text-stone mt-2">Habilidades aprendidas: ${escapeHtml(certification.learnedSkills.join(", "))}</p>` : ""}
                    ${certification.credentialUrl ? `<a href="${escapeHtml(certification.credentialUrl)}" target="_blank" rel="noopener noreferrer" class="inline-block mt-3 text-xs text-[#0563C1] underline break-all">${escapeHtml(certification.credentialUrl)}</a>` : ""}
                  </div>
                  <div class="flex gap-3"><button type="button" data-edit-certification="${certification.id}" class="text-[10px] font-bold uppercase tracking-widest">Editar</button><button type="button" data-remove-certification="${certification.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button></div>
                </div>
              </article>
            `
          )
          .join("")
      : `<p class="text-sm text-taupe">Nenhuma certificação cadastrada.</p>`;
  }
}

function renderProfileForm() {
  const profile = state.profile;
  if (!profile) return;

  setValue("profile-profile-name", profile.profileName);
  setValue("profile-name", profile.name);
  setValue("profile-title-field", profile.title);
  setValue("profile-email-contact", profile.emailContact);
  setValue("profile-phone", profile.phone);
  setValue("profile-location", profile.location);
  setValue("profile-cep", profile.cep);
  setValue("profile-linkedin", profile.linkedin);
  setValue("profile-github", profile.github);
  setValue("profile-lattes", profile.lattes);
  setValue("profile-objective", profile.objective);
  setValue("profile-seniority", profile.seniority);
  setValue("profile-summary", profile.summary);

  renderSkills();
  renderLanguages();
  renderProjects();
  renderSubprofileAllocation();
  renderEducations();
  renderExperiences();
  renderCoursesAndCertifications();
}

function profileInitials(name) {
  return String(name || "P")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

function renderProfileCards() {
  const root = document.getElementById("career-profile-cards");
  if (!root) return;

  root.innerHTML = (state.profiles || []).map((profile) => `
    <article class="profile-card ${profile.id === state.activeProfileId ? "is-active" : ""}" role="listitem">
      <button type="button" class="profile-card__select" data-select-profile="${profile.id}" aria-current="${profile.id === state.activeProfileId ? "true" : "false"}">
        <span class="profile-card__icon">${escapeHtml(profileInitials(profile.profileName))}</span>
        <span class="font-bold text-sm leading-tight">${escapeHtml(profile.profileName)}</span>
        <span class="text-[9px] uppercase tracking-widest text-stone">${profile.isGlobal ? "Principal" : "Subperfil"}</span>
      </button>
      ${profile.isGlobal ? "" : `<button type="button" data-delete-profile="${profile.id}" data-profile-name="${escapeHtml(profile.profileName)}" class="profile-card__delete" aria-label="Apagar subperfil ${escapeHtml(profile.profileName)}">x</button>`}
    </article>
  `).join("");
}

function renderMatchProfileOptions() {
  const select = document.getElementById("match-profile-id");
  if (!select) return;
  const selected = select.value;
  select.innerHTML = `
    <option value="">Escolher perfil automaticamente pelo matching</option>
    ${(state.profiles || []).map((profile) => `<option value="${profile.id}">${escapeHtml(profile.profileName)}</option>`).join("")}
  `;
  if ([...(state.profiles || []).map((profile) => profile.id), ""].includes(selected)) select.value = selected;
}

function renderHistory() {
  const root = document.getElementById("match-history");
  if (!root) return;

  const rows = state.matchHistory || [];
  if (!rows.length) {
    root.innerHTML = "";
    return;
  }

  root.innerHTML = rows
    .map(
      (item) => `
        <article class="contrast-surface border border-borderLight rounded-2xl p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <button type="button" data-open-analysis="${item.analysisId}" class="font-bold text-sm underline text-left">${escapeHtml(item.targetTitle)}</button>
              <p class="text-[10px] uppercase tracking-[0.2em] text-stone mt-1">${escapeHtml(item.company || "")} ${item.company ? "·" : ""} ${formatDateTime(item.createdAt)} · ${item.score}% · ${escapeHtml(item.status || "draft")}</p>
              ${item.linkVaga ? `<a href="${escapeHtml(item.linkVaga)}" target="_blank" rel="noopener noreferrer" class="inline-block mt-2 text-[10px] font-bold uppercase tracking-widest underline">Link da vaga</a>` : ""}
              ${item.application ? `<p class="text-[10px] uppercase tracking-[0.2em] text-stone mt-2">Candidatura: ${escapeHtml(item.application.status)} · ${escapeHtml(item.application.fase)}${item.appliedAt ? ` · aplicada em ${escapeHtml(formatDateTime(item.appliedAt))}` : ""}</p>` : ""}
              ${
                item.generatedFileName || item.resumeFileId
                  ? `
                    <div class="mt-2 flex flex-wrap gap-3">
                      ${item.generatedFileName ? `<a href="#" data-download-optimized="${item.id}" class="text-[10px] font-bold uppercase tracking-widest underline">Baixar PDF otimizado</a>` : ""}
                      ${item.resumeFileId ? `<a href="#" data-download-resume="${item.resumeFileId}" class="text-[10px] font-bold uppercase tracking-widest underline">PDF original</a>` : ""}
                      ${item.application ? `<button type="button" data-open-linked-job="${item.application.id}" class="text-[10px] font-bold uppercase tracking-widest underline">Abrir candidatura</button>` : ""}
                      ${!item.application ? `<button type="button" data-register-history-application="${item.analysisId}" class="text-[10px] font-bold uppercase tracking-widest underline">Cadastrar acompanhamento</button>` : ""}
                      ${item.status !== "applied" ? `<button type="button" data-mark-applied="${item.analysisId}" class="text-[10px] font-bold uppercase tracking-widest underline">Marcar aplicado</button>` : ""}
                    </div>
                  `
                  : ""
              }
            </div>
            <button type="button" data-remove-match="${item.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderSharedMatchedJobs() {
  const root = document.getElementById("shared-jobs-list");
  if (!root) return;

  const rows = state.sharedMatchedJobs || [];
  if (!rows.length) {
    root.innerHTML = `<p class="text-sm text-taupe">Nenhuma vaga compartilhada neste periodo.</p>`;
    return;
  }

  root.innerHTML = rows
    .map(
      (item) => `
        <article class="editorial-card rounded-2xl p-5">
          <h3 class="font-bold text-lg">${escapeHtml(item.jobTitle)}</h3>
          <p class="text-[10px] uppercase tracking-[0.25em] text-stone mt-2">${escapeHtml(item.company)}</p>
          <p class="text-xs text-taupe mt-3">${escapeHtml(formatDateTime(item.createdAt))} · ${item.origin === "tracking" ? "Cadastrada" : "Matching"}</p>
          <a href="${escapeHtml(item.jobUrl)}" target="_blank" rel="noopener noreferrer" class="inline-block mt-4 text-[10px] font-bold uppercase tracking-widest underline">Abrir vaga</a>
        </article>
      `
    )
    .join("");
}

function renderResumeFiles() {
  const list = document.getElementById("resume-files-list");
  const files = state.resumeFiles || [];

  if (!list) return;

  if (!files.length) {
    list.innerHTML = `<p class="text-sm text-taupe">Nenhum currículo PDF anexado ainda.</p>`;
    return;
  }

  list.innerHTML = files
    .map(
      (file) => `
        <article class="contrast-surface border border-borderLight rounded-2xl p-5">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h4 class="font-bold text-sm">${escapeHtml(file.fileName)}</h4>
              <p class="text-[10px] uppercase tracking-[0.2em] text-stone mt-1">
                ${formatDateTime(file.createdAt)} · ${Math.round(file.sizeBytes / 1024)} KB · anexo de referência
              </p>
              <a href="#" data-view-resume="${file.id}" class="inline-block mt-3 text-[10px] font-bold uppercase tracking-widest underline">
                Visualizar
              </a>
              <a href="#" data-download-resume="${file.id}" class="inline-block ml-4 mt-3 text-[10px] font-bold uppercase tracking-widest underline">
                Baixar original
              </a>
            </div>
            <button type="button" data-remove-resume="${file.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderMatchResult(result) {
  const root = document.getElementById("match-result");
  if (!root) return;

  const block = (title, items, positive = false) => `
    <section class="editorial-card rounded-2xl p-5">
      <h4 class="text-[10px] font-bold uppercase tracking-[0.25em] text-stone mb-3">${title}</h4>
      ${
        items.length
          ? `<div class="flex flex-wrap gap-2">${items.map((item) => `<span class="tag-pill contrast-chip ${positive ? "text-green-800" : "text-red-800"}">${escapeHtml(item)}</span>`).join("")}</div>`
          : `<p class="text-sm text-taupe">Nenhum item encontrado.</p>`
      }
    </section>
  `;

  root.className = "lg:col-span-7 space-y-4 sm:space-y-6";
  root.innerHTML = `
    <section class="editorial-card rounded-2xl sm:rounded-3xl editorial-shadow p-4 sm:p-8">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.35em] text-stone">Relatório de aderência</p>
          <h3 class="font-serif text-4xl sm:text-5xl mt-3">${result.scoreDetails.totalScore}%</h3>
        </div>
        <div class="grid grid-cols-2 gap-3 text-center">
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.skillsMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Skills</span></div>
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.projectsMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Projetos</span></div>
        </div>
      </div>
      <p class="text-sm text-taupe leading-relaxed mt-6">${escapeHtml(result.semanticFeedback)}</p>
      <p class="text-sm font-bold mt-3">${escapeHtml(result.message || "")}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        ${
          result.generatedPdfAvailable
            ? `<button type="button" data-download-current-optimized="${result.id}" class="bg-ink text-paper px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-[0.25em]">Baixar curriculo atualizado</button>
               <button type="button" data-register-application="${result.analysisId}" class="border border-borderLight px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-[0.25em]">Cadastrar acompanhamento</button>`
            : `<p class="text-sm text-taupe">Complete os dados estruturados do perfil para gerar o currículo otimizado.</p>`
        }
        <button type="button" data-new-matching class="border border-borderLight px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-[0.25em]">Novo matching</button>
      </div>
    </section>
    <section class="editorial-card rounded-2xl sm:rounded-3xl p-4 sm:p-8">
      <h4 class="font-serif text-3xl mb-4">Resumo cadastrado.</h4>
      <p class="text-sm text-taupe leading-relaxed">${escapeHtml(result.suggestedSummary)}</p>
    </section>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${block("Skills aderentes", result.matchedSkills || [], true)}
      ${block("Skills ausentes", result.missingSkills || [])}
      ${block("Keywords reconhecidas", result.jobKeywords || [], true)}
      ${block("Avisos", result.warnings || [])}
    </div>
    <section class="editorial-card rounded-2xl sm:rounded-3xl p-4 sm:p-8">
      <h4 class="font-serif text-3xl mb-4">Projetos mais fortes.</h4>
      <div class="space-y-4">
        ${(result.projectScores || [])
          .slice(0, 2)
          .map(
            (item) => `
              <article class="contrast-surface border border-borderLight rounded-2xl p-5">
                <div class="flex justify-between gap-4">
                  <h5 class="font-bold">${escapeHtml(item.project.title)}</h5>
                  <span class="font-bold">${item.score}%</span>
                </div>
                <p class="text-sm text-taupe mt-2">${escapeHtml(item.reason)}</p>
                <div class="flex flex-wrap gap-4 mt-3">
                  ${item.project.repositoryUrl ? `<a href="${escapeHtml(item.project.repositoryUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs text-[#0563C1] underline break-all">${escapeHtml(item.project.repositoryUrl)}</a>` : ""}
                  ${item.project.deployUrl ? `<a href="${escapeHtml(item.project.deployUrl)}" target="_blank" rel="noopener noreferrer" class="text-xs text-[#0563C1] underline break-all">${escapeHtml(item.project.deployUrl)}</a>` : ""}
                </div>
              </article>
            `
          )
          .join("") || `<p class="text-sm text-taupe">Cadastre projetos para melhorar a seleção automática.</p>`}
      </div>
    </section>
  `;
}

function renderAnalysisEditor(analysis) {
  const root = document.getElementById("match-result");
  if (!root) return;
  root.className = "lg:col-span-7 space-y-4 sm:space-y-6";
  root.innerHTML = `
    <form data-analysis-edit-form="${analysis.id}" class="editorial-card rounded-2xl sm:rounded-3xl editorial-shadow p-4 sm:p-8 space-y-5">
      <p class="text-[10px] font-bold uppercase tracking-[0.35em] text-stone">Análise versionada · v${analysis.version}</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input name="jobTitle" value="${escapeHtml(analysis.jobTitle)}" required class="editorial-input text-sm" />
        <input name="company" value="${escapeHtml(analysis.company || "")}" placeholder="Empresa" class="editorial-input text-sm" />
      </div>
      <input type="url" name="linkVaga" value="${escapeHtml(analysis.jobUrl || "")}" placeholder="Link da vaga" class="editorial-input text-sm" />
      <textarea name="jobDescription" rows="10" required minlength="30" maxlength="15000" class="editorial-input text-sm">${escapeHtml(analysis.jobDescription)}</textarea>
      <textarea name="notes" rows="3" placeholder="Notas da revisão" class="editorial-input text-sm">${escapeHtml(analysis.notes || "")}</textarea>
      <select name="status" class="editorial-input text-sm bg-white">
        ${["draft", "reviewed", "applied", "archived", "rejected"].map((status) => `<option value="${status}" ${analysis.status === status ? "selected" : ""}>${status}</option>`).join("")}
      </select>
      <div class="flex flex-wrap gap-3">
        <button type="submit" class="bg-ink text-paper px-8 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest">Salvar nova versão</button>
        ${analysis.generatedResume?.id ? `<button type="button" data-download-current-optimized="${analysis.generatedResume.id}" class="border border-borderLight px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest">Baixar currículo</button>` : ""}
        ${analysis.applications?.length
          ? `<button type="button" data-open-analysis-job="${analysis.applications[0].id}" class="border border-borderLight px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest">Abrir acompanhamento</button>`
          : `<button type="button" data-register-application="${analysis.id}" class="border border-borderLight px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-widest">Cadastrar acompanhamento</button>`}
      </div>
    </form>
  `;
}

function renderMatchLoading() {
  const root = document.getElementById("match-result");
  if (!root) return;

  root.className = "lg:col-span-7 space-y-4 sm:space-y-6";
  root.innerHTML = `
    <section class="editorial-card rounded-2xl sm:rounded-3xl editorial-shadow p-4 sm:p-8">
      <p class="text-[10px] font-bold uppercase tracking-[0.35em] text-stone">Processando</p>
      <h3 class="font-serif text-4xl mt-3">Calculando aderencia ATS.</h3>
      <p class="text-sm text-taupe leading-relaxed mt-4">
        Estamos comparando a vaga exclusivamente com os dados estruturados do perfil ativo.
      </p>
    </section>
  `;
}

export const career = {
  newMatching() {
    const form = document.getElementById("form-match");
    form?.reset();
    state.lastMatchResult = null;
    renderMatchProfileOptions();
    const root = document.getElementById("match-result");
    if (root) {
      root.className = "lg:col-span-7 min-h-[240px] sm:min-h-[420px] rounded-2xl sm:rounded-3xl border border-dashed border-borderLight p-5 sm:p-10 flex items-center justify-center text-center text-taupe";
      root.textContent = "Cole uma vaga para ver score, lacunas e projetos mais aderentes.";
    }
    document.getElementById("match-job-title")?.focus();
  },

  async loadProfiles() {
    const profiles = await api("/profiles", {}, state.token);
    state.profiles = Array.isArray(profiles) ? profiles : [];
    if (!state.activeProfileId && state.profiles[0]) {
      state.activeProfileId = state.profiles[0].id;
    }
    renderProfileCards();
    renderMatchProfileOptions();
  },

  async ensureProfiles() {
    if (state.profiles?.length) return state.profiles;
    if (!profilesRequest) {
      profilesRequest = career.loadProfiles().finally(() => {
        profilesRequest = null;
      });
    }
    await profilesRequest;
    return state.profiles;
  },

  async prefetchProfile(profileId) {
    const cacheKey = profileCacheKey(profileId);
    const revision = profileRevision;
    const snapshot = profileCache.get(cacheKey);
    if (snapshot && Date.now() - snapshot.savedAt < PROFILE_CLIENT_CACHE_MS) return snapshot.profile;
    if (profileRequests.has(cacheKey)) return profileRequests.get(cacheKey);
    let request = null;
    request = api(`/profile?profileId=${encodeURIComponent(profileId)}`, { silent: true }, state.token)
      .then((profile) => {
        if (revision !== profileRevision) return null;
        profileCache.set(cacheKey, { profile, savedAt: Date.now() });
        return profile;
      })
      .finally(() => {
        if (profileRequests.get(cacheKey) === request) profileRequests.delete(cacheKey);
      });
    profileRequests.set(cacheKey, request);
    return request;
  },

  async preloadProfileData() {
    const profiles = state.profiles || [];
    await prefetchWithLimit(profiles, async (profile) => {
      await Promise.all([
        career.prefetchProfile(profile.id),
        career.prefetchHistory(profile.id),
        career.prefetchResumeFiles(profile.id),
      ]);
    });
  },

  async loadProfile({ requestId = null, announce = false, force = false } = {}) {
    const selectedProfileId = state.activeProfileId;
    const label = profileLabel(selectedProfileId);
    const cacheKey = profileCacheKey(selectedProfileId);
    const revision = profileRevision;
    const query = selectedProfileId ? `?profileId=${encodeURIComponent(selectedProfileId)}` : "";

    const snapshot = profileCache.get(cacheKey);
    if (!force && snapshot && Date.now() - snapshot.savedAt < PROFILE_CLIENT_CACHE_MS) {
      if (!isCurrentProfileRequest(requestId, selectedProfileId)) return null;
      showProfile(snapshot.profile);
      if (announce) setLoadStatus("profile-load-status", `Informacoes de ${snapshot.profile.profileName || label} carregadas.`, "loaded", 5000);
      return snapshot.profile;
    }

    if (announce) setLoadStatus("profile-load-status", `Carregando informacoes de ${label}...`, "loading");
    let request = null;
    try {
      request = !force ? profileRequests.get(cacheKey) : null;
      if (!request) {
        request = api(`/profile${query}`, {}, state.token);
        profileRequests.set(cacheKey, request);
      }
      const profile = await request;
      if (profileRequests.get(cacheKey) === request) profileRequests.delete(cacheKey);
      if (revision !== profileRevision) return null;
      if (!isCurrentProfileRequest(requestId, selectedProfileId)) return null;
      profileCache.set(cacheKey, { profile, savedAt: Date.now() });
      showProfile(profile);
      if (announce) setLoadStatus("profile-load-status", `Informacoes de ${profile.profileName || label} carregadas.`, "loaded", 5000);
      return profile;
    } catch (err) {
      if (profileRequests.get(cacheKey) === request) profileRequests.delete(cacheKey);
      if (announce && isCurrentProfileRequest(requestId, selectedProfileId)) {
        setLoadStatus("profile-load-status", `Nao foi possivel carregar ${label}.`, "error");
      }
      throw err;
    }
  },

  async loadHistory({ requestId = null, announce = true, force = false, successMessage = "Histórico carregado." } = {}) {
    const selectedProfileId = state.activeProfileId;
    const cacheKey = historyCacheKey(selectedProfileId);
    const revision = historyRevision;
    const query = selectedProfileId ? `?profileId=${encodeURIComponent(selectedProfileId)}` : "";
    const snapshot = historyCache.get(cacheKey);

    if (!force && snapshot && Date.now() - snapshot.savedAt < HISTORY_CLIENT_CACHE_MS) {
      if (!isCurrentProfileRequest(requestId, selectedProfileId)) return null;
      state.matchHistory = snapshot.rows;
      renderHistory();
      if (announce) {
        setLoadStatus(
          "match-history-status",
          state.matchHistory.length ? successMessage : "Nenhuma analise encontrada no historico.",
          "loaded",
          5000
        );
      }
      return state.matchHistory;
    }

    if (announce) setLoadStatus("match-history-status", "Carregando histórico...", "loading");

    let request = null;
    try {
      request = !force ? historyRequests.get(cacheKey) : null;
      if (!request) {
        request = api(`/optimized-resumes${query}`, {}, state.token);
        historyRequests.set(cacheKey, request);
      }
      const history = await request;
      if (historyRequests.get(cacheKey) === request) historyRequests.delete(cacheKey);
      if (revision !== historyRevision) return null;
      if (!isCurrentProfileRequest(requestId, selectedProfileId)) return null;
      state.matchHistory = Array.isArray(history) ? history : [];
      historyCache.set(cacheKey, { rows: state.matchHistory, savedAt: Date.now() });
      renderHistory();
      if (announce) {
        setLoadStatus(
          "match-history-status",
          state.matchHistory.length ? successMessage : "Nenhuma analise encontrada no historico.",
          "loaded",
          5000
        );
      }
      return state.matchHistory;
    } catch (err) {
      if (historyRequests.get(cacheKey) === request) historyRequests.delete(cacheKey);
      if (announce && isCurrentProfileRequest(requestId, selectedProfileId)) {
        setLoadStatus("match-history-status", "Não foi possível carregar o histórico.", "error");
      }
      throw err;
    }
  },

  async prefetchHistory(profileId) {
    const cacheKey = historyCacheKey(profileId);
    const revision = historyRevision;
    const snapshot = historyCache.get(cacheKey);
    if (snapshot && Date.now() - snapshot.savedAt < HISTORY_CLIENT_CACHE_MS) return snapshot.rows;
    if (historyRequests.has(cacheKey)) return historyRequests.get(cacheKey);
    let request = null;
    request = api(`/optimized-resumes?profileId=${encodeURIComponent(profileId)}`, { silent: true }, state.token)
      .then((rows) => {
        if (revision !== historyRevision) return null;
        const history = Array.isArray(rows) ? rows : [];
        historyCache.set(cacheKey, { rows: history, savedAt: Date.now() });
        return history;
      })
      .finally(() => {
        if (historyRequests.get(cacheKey) === request) historyRequests.delete(cacheKey);
      });
    historyRequests.set(cacheKey, request);
    return request;
  },

  async loadSharedMatchedJobs() {
    const period = state.sharedMatchedJobsPeriod || "month";
    const rows = await api(`/shared-matched-jobs?period=${encodeURIComponent(period)}`, {}, state.token);
    state.sharedMatchedJobs = Array.isArray(rows) ? rows : [];
    renderSharedMatchedJobs();
  },

  async saveProfile() {
    const payload = {
      profileId: state.activeProfileId,
      profileName: document.getElementById("profile-profile-name")?.value || "",
      name: document.getElementById("profile-name")?.value || "",
      title: document.getElementById("profile-title-field")?.value || "",
      emailContact: document.getElementById("profile-email-contact")?.value || "",
      phone: document.getElementById("profile-phone")?.value || "",
      location: document.getElementById("profile-location")?.value || "",
      cep: document.getElementById("profile-cep")?.value || "",
      linkedin: document.getElementById("profile-linkedin")?.value || "",
      github: document.getElementById("profile-github")?.value || "",
      lattes: document.getElementById("profile-lattes")?.value || "",
      objective: document.getElementById("profile-objective")?.value || "",
      seniority: document.getElementById("profile-seniority")?.value || "",
      summary: document.getElementById("profile-summary")?.value || "",
    };
    const out = await api("/profile", { method: "PUT", body: JSON.stringify(payload) }, state.token);
    replaceEditedProfile(out.user);
    await career.loadProfiles();
    ui.notify("Perfil profissional atualizado.");
  },

  async addSkill(value) {
    const current = state.profile?.skills || [];
    const submitted = String(value || "").split(",").map((skill) => skill.trim()).filter(Boolean);
    const skills = [...new Map([...current, ...submitted].map((skill) => [skill.toLocaleLowerCase("pt-BR"), skill])).values()];
    const out = await api("/profile/skills", { method: "PUT", body: JSON.stringify({ profileId: state.activeProfileId, skills }) }, state.token);
    replaceEditedProfile(out.user);
  },

  async removeSkill(name) {
    const skills = (state.profile?.skills || []).filter((skill) => skill !== name);
    const out = await api("/profile/skills", { method: "PUT", body: JSON.stringify({ profileId: state.activeProfileId, skills }) }, state.token);
    replaceEditedProfile(out.user);
  },

  async addLanguage(payload) {
    const out = await api("/profile/languages", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Idioma cadastrado.");
  },

  async updateLanguage(id, payload) {
    const out = await api(`/profile/languages/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Idioma atualizado.");
  },

  async addEducation(payload) {
    const out = await api("/profile/educations", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Formação cadastrada no Perfil Global.");
  },

  async updateEducation(id, payload) {
    const out = await api(`/profile/educations/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Formacao atualizada.");
  },

  async removeEducation(id) {
    const out = await api(`/profile/educations/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    replaceEditedProfile(out.user);
  },

  async removeLanguage(id) {
    const out = await api(`/profile/languages/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    replaceEditedProfile(out.user);
  },

  async addProject(payload) {
    const out = await api("/profile/projects", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Projeto cadastrado.");
  },

  async saveAllocation(payload) {
    const out = await api("/profile/subprofile-allocation", { method: "PUT", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Itens do Perfil Global alocados ao subperfil.");
  },

  async updateProject(id, payload) {
    const out = await api(`/profile/projects/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Projeto atualizado.");
  },

  async removeProject(id) {
    const out = await api(`/profile/projects/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    replaceEditedProfile(out.user);
  },

  async addExperience(payload) {
    const out = await api("/profile/experiences", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Experiência cadastrada.");
  },

  async updateExperience(id, payload) {
    const out = await api(`/profile/experiences/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Experiencia atualizada.");
  },

  async removeExperience(id) {
    const out = await api(`/profile/experiences/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    replaceEditedProfile(out.user);
  },

  async addCourse(payload) {
    const out = await api("/profile/courses", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Curso cadastrado.");
  },

  async updateCourse(id, payload) {
    const out = await api(`/profile/courses/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Curso atualizado.");
  },

  async removeCourse(id) {
    const out = await api(`/profile/courses/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    replaceEditedProfile(out.user);
  },

  async addCertification(payload) {
    const out = await api("/profile/certifications", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Certificação cadastrada.");
  },

  async updateCertification(id, payload) {
    const out = await api(`/profile/certifications/${id}`, { method: "PUT", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    replaceEditedProfile(out.user);
    ui.notify("Certificacao atualizada.");
  },

  async removeCertification(id) {
    const out = await api(`/profile/certifications/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    replaceEditedProfile(out.user);
  },

  async match(jobDescription) {
    renderMatchLoading();
    const jobTitle = document.getElementById("match-job-title")?.value || "";
    const company = document.getElementById("match-company")?.value || "";
    const linkVaga = document.getElementById("match-job-link")?.value || "";
    const requestedProfileId = document.getElementById("match-profile-id")?.value || undefined;
    const result = await api("/match", { method: "POST", body: JSON.stringify({ jobDescription, jobTitle, company, linkVaga, profileId: requestedProfileId }) }, state.token);
    state.lastMatchResult = result;
    renderMatchResult(result);
    invalidateHistoryCache();
    const reloads = [career.loadSharedMatchedJobs()];
    if (result.selectedSubprofileId && result.selectedSubprofileId !== state.activeProfileId) {
      state.activeProfileId = result.selectedSubprofileId;
      renderProfileCards();
      reloads.push(career.loadHistory({
        announce: true,
        force: true,
        successMessage: "Histórico atualizado.",
      }));
    } else {
      reloads.push(career.loadHistory({ force: true, successMessage: "Histórico atualizado." }));
    }
    await Promise.all(reloads);
  },

  async removeMatch(id) {
    await api(`/optimized-resumes/${id}`, { method: "DELETE" }, state.token);
    invalidateHistoryCache();
    await Promise.all([jobs.load(), career.loadHistory({ force: true, successMessage: "Histórico atualizado." })]);
  },

  async markAnalysisApplied(id) {
    const out = await api(`/job-analyses/${id}`, { method: "PATCH", body: JSON.stringify({ status: "applied" }) }, state.token);
    ui.notify(out.message);
    invalidateHistoryCache();
    await Promise.all([jobs.load(), career.loadHistory({ force: true, successMessage: "Histórico atualizado." })]);
  },

  async openAnalysis(id) {
    const analysis = await api(`/job-analyses/${id}`, {}, state.token);
    state.lastMatchResult = {
      analysisId: analysis.id,
      targetTitle: analysis.jobTitle,
      selectedSubprofileName: analysis.selectedSubprofile?.profileName || "",
      score: analysis.matchScore,
      linkVaga: analysis.jobUrl || "",
    };
    renderAnalysisEditor(analysis);
  },

  async saveAnalysisVersion(id, payload) {
    const out = await api(`/job-analyses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, state.token);
    ui.notify(out.message);
    invalidateHistoryCache();
    await Promise.all([jobs.load(), career.loadHistory({ force: true, successMessage: "Histórico atualizado." }), career.openAnalysis(out.analysis.id)]);
  },

  async createApplication(analysisId, payload) {
    let out;
    try {
      out = await api(`/job-analyses/${analysisId}/create-application`, { method: "POST", body: JSON.stringify(payload) }, state.token);
    } catch (err) {
      if (err.status !== 409 || !window.confirm("Esta análise já possui candidatura. Deseja registrar outra candidatura mesmo assim?")) throw err;
      out = await api(`/job-analyses/${analysisId}/create-application`, { method: "POST", body: JSON.stringify({ ...payload, confirmDuplicate: true }) }, state.token);
    }
    ui.closeApplicationModal();
    invalidateHistoryCache();
    await Promise.all([jobs.load(), career.loadHistory({ force: true, successMessage: "Histórico atualizado." })]);
    ui.notify("Candidatura registrada com sucesso. Você poderá acompanhar essa vaga no painel de candidaturas.");
    return out;
  },

  async refreshHistoryAfterTrackingChange() {
    invalidateHistoryCache();
    if (!document.getElementById("panel-matching")?.classList.contains("hidden")) {
      await Promise.all([jobs.load(), career.loadHistory({ force: true, successMessage: "Histórico atualizado." })]);
    }
  },

  beginEdit(type, id) {
    const collections = {
      education: state.profile?.educations,
      experience: state.profile?.experiences,
      project: state.profile?.projects,
      course: state.profile?.courses,
      certification: state.profile?.certifications,
      language: state.profile?.languages,
    };
    const item = (collections[type] || []).find((entry) => entry.id === id);
    if (!item) return;
    if (type === "education") {
      setValue("education-title-field", item.title);
      setValue("education-institution", item.institution);
      setValue("education-period", item.period);
      setValue("education-learned-skills", (item.learnedSkills || []).join(", "));
    } else if (type === "experience") {
      setValue("experience-company", item.company);
      setValue("experience-role", item.role);
      setValue("experience-period", item.period);
      setValue("experience-workload", item.workload);
      setValue("experience-description", item.description);
    } else if (type === "project") {
      setValue("project-title", item.title);
      setValue("project-category", item.category);
      setValue("project-short-description", item.shortDescription);
      setValue("project-stack", item.stack);
      setValue("project-learned-skills", (item.learnedSkills || []).join(", "));
      setValue("project-repository-url", item.repositoryUrl);
      setValue("project-deploy-url", item.deployUrl);
    } else if (type === "course") {
      setValue("course-title", item.title);
      setValue("course-institution", item.institution);
      setValue("course-period", item.period);
      setValue("course-workload", item.workload);
      setValue("course-description", item.description);
      setValue("course-learned-skills", (item.learnedSkills || []).join(", "));
    } else if (type === "certification") {
      setValue("certification-title", item.title);
      setValue("certification-issuer", item.issuer);
      setValue("certification-period", item.period);
      setValue("certification-workload", item.workload);
      setValue("certification-url", item.credentialUrl);
      setValue("certification-learned-skills", (item.learnedSkills || []).join(", "));
    } else if (type === "language") {
      setValue("language-name", item.name);
      setValue("language-level", item.level);
    }
    setEditMode(type, id);
  },

  cancelEdit(type) {
    clearEditMode(type);
  },

  async prefetchResumeFiles(profileId) {
    const cacheKey = resumeFilesCacheKey(profileId);
    const revision = resumeFilesRevision;
    const snapshot = resumeFilesCache.get(cacheKey);
    if (snapshot && Date.now() - snapshot.savedAt < RESUME_FILES_CLIENT_CACHE_MS) return snapshot.files;
    if (resumeFilesRequests.has(cacheKey)) return resumeFilesRequests.get(cacheKey);
    let request = null;
    request = api(`/resume-files?profileId=${encodeURIComponent(profileId)}`, { silent: true }, state.token)
      .then((rows) => {
        if (revision !== resumeFilesRevision) return null;
        const files = Array.isArray(rows) ? rows : [];
        resumeFilesCache.set(cacheKey, { files, savedAt: Date.now() });
        return files;
      })
      .finally(() => {
        if (resumeFilesRequests.get(cacheKey) === request) resumeFilesRequests.delete(cacheKey);
      });
    resumeFilesRequests.set(cacheKey, request);
    return request;
  },

  async loadResumeFiles({ requestId = null, force = false } = {}) {
    const selectedProfileId = state.activeProfileId;
    const cacheKey = resumeFilesCacheKey(selectedProfileId);
    const revision = resumeFilesRevision;
    const query = selectedProfileId ? `?profileId=${encodeURIComponent(selectedProfileId)}` : "";
    const snapshot = resumeFilesCache.get(cacheKey);
    if (!force && snapshot && Date.now() - snapshot.savedAt < RESUME_FILES_CLIENT_CACHE_MS) {
      if (!isCurrentProfileRequest(requestId, selectedProfileId)) return null;
      if (state.resumeFiles !== snapshot.files) {
        state.resumeFiles = snapshot.files;
        renderResumeFiles();
      }
      return state.resumeFiles;
    }
    let request = !force ? resumeFilesRequests.get(cacheKey) : null;
    if (!request) {
      request = api(`/resume-files${query}`, {}, state.token)
        .finally(() => {
          if (resumeFilesRequests.get(cacheKey) === request) resumeFilesRequests.delete(cacheKey);
        });
      resumeFilesRequests.set(cacheKey, request);
    }
    const files = await request;
    if (revision !== resumeFilesRevision) return null;
    if (!isCurrentProfileRequest(requestId, selectedProfileId)) return null;
    state.resumeFiles = Array.isArray(files) ? files : [];
    resumeFilesCache.set(cacheKey, { files: state.resumeFiles, savedAt: Date.now() });
    renderResumeFiles();
    return state.resumeFiles;
  },

  async uploadResumeFile(file) {
    const formData = new FormData();
    formData.append("resume", file);
    formData.append("profileId", state.activeProfileId);
    const out = await api(
      "/resume-files",
      {
        method: "POST",
        body: formData,
        headers: {},
      },
      state.token
    );
    state.resumeFiles = [out, ...(state.resumeFiles || [])];
    resumeFilesRevision += 1;
    resumeFilesCache.set(resumeFilesCacheKey(state.activeProfileId), { files: state.resumeFiles, savedAt: Date.now() });
    renderResumeFiles();
    ui.notify("Currículo PDF anexado somente como referência.");
  },

  async removeResumeFile(id) {
    await api(`/resume-files/${id}`, { method: "DELETE" }, state.token);
    invalidateResumeFilesCache();
    await career.loadResumeFiles({ force: true });
  },

  async downloadResumeFile(id) {
    const { API_URL } = await import("./config.js");
    const response = await fetch(`${API_URL}/resume-files/${id}/download`, {
      credentials: "include",
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
    });

    if (!response.ok) {
      ui.notify("Não foi possível baixar o PDF.", "error");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "curriculo.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  async viewResumeFile(id) {
    const { API_URL } = await import("./config.js");
    const previewWindow = window.open("", "_blank");
    const response = await fetch(`${API_URL}/resume-files/${id}/view`, {
      credentials: "include",
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
    });
    if (!response.ok) {
      previewWindow?.close();
      ui.notify("Não foi possível visualizar o PDF.", "error");
      return;
    }
    const url = URL.createObjectURL(await response.blob());
    if (previewWindow) previewWindow.location.href = url;
    else window.open(url, "_blank", "noopener");
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  },

  async downloadOptimizedResume(id) {
    const { API_URL } = await import("./config.js");
    const response = await fetch(`${API_URL}/optimized-resumes/${id}/download`, {
      credentials: "include",
      headers: state.token ? { Authorization: `Bearer ${state.token}` } : {},
    });

    if (!response.ok) {
      ui.notify("Não foi possível baixar o PDF otimizado.", "error");
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "curriculo-otimizado.pdf";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  },

  async createProfile(profileName) {
    const profile = await api("/profiles", { method: "POST", body: JSON.stringify({ profileName }) }, state.token);
    state.activeProfileId = profile.id;
    await career.loadProfiles();
    await career.loadActiveProfileData({ announce: true });
    ui.notify("Perfil criado.");
  },

  async deleteProfile(profileId) {
    await api(`/profiles/${profileId}`, { method: "DELETE" }, state.token);
    if (state.activeProfileId === profileId) {
      state.activeProfileId = "";
    }
    await career.loadProfiles();
    profileRevision += 1;
    profileCache.clear();
    profileRequests.clear();
    invalidateHistoryCache();
    invalidateResumeFilesCache();
    if (!state.profiles.some((profile) => profile.id === state.activeProfileId)) {
      state.activeProfileId = state.profiles.find((profile) => profile.isGlobal)?.id || state.profiles[0]?.id || "";
    }
    await career.loadActiveProfileData({ announce: true });
    ui.notify("Subperfil removido.");
  },

  async switchProfile(profileId) {
    state.activeProfileId = profileId;
    renderProfileCards();
    await career.loadActiveProfileData({ announce: true });
  },

  async loadActiveProfileData({ announce = false, historyForce = false, historySuccessMessage = "Histórico carregado." } = {}) {
    const requestId = ++activeProfileRequestId;
    const loads = [
      career.loadProfile({ requestId, announce }),
      career.loadResumeFiles({ requestId }),
    ];
    if (!document.getElementById("panel-matching")?.classList.contains("hidden")) {
      loads.push(career.loadHistory({ requestId, announce, force: historyForce, successMessage: historySuccessMessage }));
    }
    await Promise.all(loads);
  },

  setTab(tab) {
    document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.dashboardTab === tab);
    });
    document.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.dashboardPanel !== tab);
    });
    if (tab === "shared-jobs") {
      career.loadSharedMatchedJobs().catch(() => {});
    }
    if (tab === "matching") {
      career.ensureProfiles()
        .then(() => career.loadHistory({ announce: true }))
        .catch(() => {});
    }
    if (tab === "profile") {
      career.ensureProfiles()
        .then(() => career.loadActiveProfileData({ announce: true }))
        .catch(() => {});
    }
  },
};
