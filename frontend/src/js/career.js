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
        <span class="tag-pill">
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
        <span class="tag-pill">
          ${escapeHtml([language.name, language.level].filter(Boolean).join(" - "))}
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
        <article class="border border-borderLight rounded-2xl p-5 bg-white">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h4 class="font-serif text-2xl">${escapeHtml(project.title)}</h4>
              <p class="text-sm text-taupe mt-2 leading-relaxed">${escapeHtml(project.description)}</p>
              <div class="flex flex-wrap gap-4 mt-3">
                ${project.repositoryUrl ? `<a href="${escapeHtml(project.repositoryUrl)}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-bold uppercase tracking-widest underline">Repositório</a>` : ""}
                ${project.deployUrl ? `<a href="${escapeHtml(project.deployUrl)}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-bold uppercase tracking-widest underline">Deploy</a>` : ""}
              </div>
            </div>
            <button type="button" data-remove-project="${project.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
          </div>
          <div class="flex flex-wrap gap-2 mt-4">
            ${(project.technologies || []).map((tech) => `<span class="tag-pill">${escapeHtml(tech)}</span>`).join("")}
          </div>
          <div class="mt-4 space-y-2">
            ${(project.bullets || []).map((bullet) => `<p class="text-sm text-taupe">- ${escapeHtml(bullet.content)}</p>`).join("")}
          </div>
          <form data-project-bullet-form="${project.id}" class="grid grid-cols-1 md:grid-cols-4 gap-2 mt-4 border-t border-borderLight pt-4">
            <select name="category" class="editorial-input text-xs bg-white">
              <option value="backend">Backend</option><option value="frontend">Frontend</option><option value="data">Dados</option><option value="architecture">Arquitetura</option><option value="devops">DevOps</option><option value="business">Negócio</option>
            </select>
            <input name="content" required minlength="10" maxlength="240" placeholder="Bullet factual reutilizável" class="editorial-input text-xs md:col-span-2" />
            <button type="submit" class="bg-ink text-paper rounded-full text-[10px] font-bold uppercase">Adicionar bullet</button>
            <input name="keywords" placeholder="Keywords: node, sql, docker" class="editorial-input text-xs md:col-span-3" />
            <input name="weight" type="number" min="0" max="100" value="50" class="editorial-input text-xs" />
          </form>
        </article>
      `
    )
    .join("");
}

function renderEducations() {
  const root = document.getElementById("educations-list");
  if (!root) return;
  const items = state.profile?.educations || [];
  root.innerHTML = items.length ? items.map((item) => `
    <article class="border border-borderLight rounded-2xl p-4 bg-white flex justify-between gap-3">
      <p class="text-sm"><strong>${escapeHtml(item.title)}</strong> | ${escapeHtml(item.institution)}${item.period ? ` | ${escapeHtml(item.period)}` : ""}</p>
      ${state.profile?.isGlobal ? `<button type="button" data-remove-education="${item.id}" class="text-[10px] font-bold uppercase text-red-700">Remover</button>` : ""}
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
        <article class="border border-borderLight rounded-2xl p-5 bg-white">
          <div class="flex items-start justify-between gap-4">
            <div>
              <h4 class="font-bold">${escapeHtml(experience.role)}</h4>
              <p class="text-[10px] uppercase tracking-[0.25em] text-stone mt-1">${escapeHtml(experience.company)} · ${escapeHtml(experience.period)}</p>
            </div>
            <button type="button" data-remove-experience="${experience.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
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
              <article class="border border-borderLight rounded-2xl p-5 bg-white">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h4 class="font-bold">${escapeHtml(course.title)}</h4>
                    <p class="text-[10px] uppercase tracking-[0.25em] text-stone mt-1">${escapeHtml(course.institution || "Instituição não informada")} ${course.period ? `· ${escapeHtml(course.period)}` : ""}</p>
                    ${course.description ? `<p class="text-sm text-taupe mt-3">${escapeHtml(course.description)}</p>` : ""}
                  </div>
                  <button type="button" data-remove-course="${course.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
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
              <article class="border border-borderLight rounded-2xl p-5 bg-white">
                <div class="flex items-start justify-between gap-4">
                  <div>
                    <h4 class="font-bold">${escapeHtml(certification.title)}</h4>
                    <p class="text-[10px] uppercase tracking-[0.25em] text-stone mt-1">${escapeHtml(certification.issuer || "Emissor não informado")} ${certification.period ? `· ${escapeHtml(certification.period)}` : ""}</p>
                    ${certification.credentialUrl ? `<a href="${escapeHtml(certification.credentialUrl)}" target="_blank" rel="noopener noreferrer" class="inline-block mt-3 text-[10px] font-bold uppercase tracking-widest underline">Credencial</a>` : ""}
                  </div>
                  <button type="button" data-remove-certification="${certification.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
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
  setValue("profile-linkedin", profile.linkedin);
  setValue("profile-github", profile.github);
  setValue("profile-lattes", profile.lattes);
  setValue("profile-summary", profile.summary);

  renderSkills();
  renderLanguages();
  renderProjects();
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

function renderHistory() {
  const root = document.getElementById("match-history");
  if (!root) return;

  const rows = state.matchHistory || [];
  if (!rows.length) {
    root.innerHTML = `<p class="text-sm text-taupe">Nenhuma análise salva ainda.</p>`;
    return;
  }

  root.innerHTML = rows
    .map(
      (item) => `
        <article class="border border-borderLight rounded-2xl p-4 bg-white">
          <div class="flex items-start justify-between gap-3">
            <div>
              <button type="button" data-open-analysis="${item.analysisId}" class="font-bold text-sm underline text-left">${escapeHtml(item.targetTitle)}</button>
              <p class="text-[10px] uppercase tracking-[0.2em] text-stone mt-1">${escapeHtml(item.company || "")} ${item.company ? "·" : ""} ${formatDateTime(item.createdAt)} · ${item.score}% · ${escapeHtml(item.status || "draft")}</p>
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
        <article class="border border-borderLight rounded-2xl p-5 bg-white">
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
          ? `<div class="flex flex-wrap gap-2">${items.map((item) => `<span class="tag-pill ${positive ? "text-green-800" : "text-red-800"}">${escapeHtml(item)}</span>`).join("")}</div>`
          : `<p class="text-sm text-taupe">Nenhum item encontrado.</p>`
      }
    </section>
  `;

  root.className = "lg:col-span-7 space-y-6";
  root.innerHTML = `
    <section class="editorial-card rounded-3xl editorial-shadow p-8">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.35em] text-stone">Relatório de aderência</p>
          <h3 class="font-serif text-5xl mt-3">${result.scoreDetails.totalScore}%</h3>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.skillsMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Skills</span></div>
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.projectsMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Projetos</span></div>
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.coursesAndCertificationsMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Formação</span></div>
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.experiencesMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Experiência</span></div>
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
      </div>
    </section>
    <section class="editorial-card rounded-3xl p-8">
      <h4 class="font-serif text-3xl mb-4">Resumo sugerido.</h4>
      <p class="text-sm text-taupe leading-relaxed">${escapeHtml(result.suggestedSummary)}</p>
    </section>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      ${block("Skills aderentes", result.matchedSkills || [], true)}
      ${block("Skills ausentes", result.missingSkills || [])}
      ${block("Keywords reconhecidas", result.jobKeywords || [], true)}
      ${block("Avisos", result.warnings || [])}
    </div>
    <section class="editorial-card rounded-3xl p-8">
      <h4 class="font-serif text-3xl mb-4">Projetos mais fortes.</h4>
      <div class="space-y-4">
        ${(result.projectScores || [])
          .slice(0, 2)
          .map(
            (item) => `
              <article class="border border-borderLight rounded-2xl p-5 bg-white">
                <div class="flex justify-between gap-4">
                  <h5 class="font-bold">${escapeHtml(item.project.title)}</h5>
                  <span class="font-bold">${item.score}%</span>
                </div>
                <p class="text-sm text-taupe mt-2">${escapeHtml(item.reason)}</p>
                <div class="flex flex-wrap gap-4 mt-3">
                  ${item.project.repositoryUrl ? `<a href="${escapeHtml(item.project.repositoryUrl)}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-bold uppercase tracking-widest underline">Repositório</a>` : ""}
                  ${item.project.deployUrl ? `<a href="${escapeHtml(item.project.deployUrl)}" target="_blank" rel="noopener noreferrer" class="text-[10px] font-bold uppercase tracking-widest underline">Deploy</a>` : ""}
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
  root.className = "lg:col-span-7 space-y-6";
  root.innerHTML = `
    <form data-analysis-edit-form="${analysis.id}" class="editorial-card rounded-3xl editorial-shadow p-8 space-y-5">
      <p class="text-[10px] font-bold uppercase tracking-[0.35em] text-stone">Análise versionada · v${analysis.version}</p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input name="jobTitle" value="${escapeHtml(analysis.jobTitle)}" required class="editorial-input text-sm" />
        <input name="company" value="${escapeHtml(analysis.company || "")}" placeholder="Empresa" class="editorial-input text-sm" />
      </div>
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

  root.className = "lg:col-span-7 space-y-6";
  root.innerHTML = `
    <section class="editorial-card rounded-3xl editorial-shadow p-8">
      <p class="text-[10px] font-bold uppercase tracking-[0.35em] text-stone">Processando</p>
      <h3 class="font-serif text-4xl mt-3">Calculando aderencia ATS.</h3>
      <p class="text-sm text-taupe leading-relaxed mt-4">
        Estamos comparando a vaga exclusivamente com os dados estruturados do perfil ativo.
      </p>
    </section>
  `;
}

export const career = {
  async loadProfiles() {
    const profiles = await api("/profiles", {}, state.token);
    state.profiles = Array.isArray(profiles) ? profiles : [];
    if (!state.activeProfileId && state.profiles[0]) {
      state.activeProfileId = state.profiles[0].id;
      localStorage.setItem("vagas_active_profile_id", state.activeProfileId);
    }
    renderProfileCards();
  },

  async loadProfile() {
    const query = state.activeProfileId ? `?profileId=${encodeURIComponent(state.activeProfileId)}` : "";
    const profile = await api(`/profile${query}`, {}, state.token);
    state.profile = profile;
    state.activeProfileId = profile.id;
    localStorage.setItem("vagas_active_profile_id", profile.id);
    renderProfileForm();
  },

  async loadHistory() {
    const query = state.activeProfileId ? `?profileId=${encodeURIComponent(state.activeProfileId)}` : "";
    const history = await api(`/optimized-resumes${query}`, {}, state.token);
    state.matchHistory = Array.isArray(history) ? history : [];
    renderHistory();
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
      linkedin: document.getElementById("profile-linkedin")?.value || "",
      github: document.getElementById("profile-github")?.value || "",
      lattes: document.getElementById("profile-lattes")?.value || "",
      summary: document.getElementById("profile-summary")?.value || "",
    };
    const out = await api("/profile", { method: "PUT", body: JSON.stringify(payload) }, state.token);
    state.profile = out.user;
    await career.loadProfiles();
    renderProfileForm();
    ui.notify("Perfil profissional atualizado.");
  },

  async addSkill(name) {
    const current = state.profile?.skills || [];
    const skills = [...current, name].filter(Boolean);
    const out = await api("/profile/skills", { method: "PUT", body: JSON.stringify({ profileId: state.activeProfileId, skills }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
  },

  async removeSkill(name) {
    const skills = (state.profile?.skills || []).filter((skill) => skill !== name);
    const out = await api("/profile/skills", { method: "PUT", body: JSON.stringify({ profileId: state.activeProfileId, skills }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
  },

  async addLanguage(payload) {
    const out = await api("/profile/languages", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
    ui.notify("Idioma cadastrado.");
  },

  async addEducation(payload) {
    const out = await api("/profile/educations", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
    ui.notify("Formação cadastrada no Perfil Global.");
  },

  async removeEducation(id) {
    const out = await api(`/profile/educations/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    state.profile = out.user;
    renderProfileForm();
  },

  async removeLanguage(id) {
    const out = await api(`/profile/languages/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    state.profile = out.user;
    renderProfileForm();
  },

  async addProject(payload) {
    const out = await api("/profile/projects", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
    ui.notify("Projeto cadastrado.");
  },

  async addProjectBullet(projectId, payload) {
    const out = await api(`/profile/projects/${projectId}/bullets`, { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
    ui.notify("Bullet cadastrado para seleção determinística.");
  },

  async removeProject(id) {
    const out = await api(`/profile/projects/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    state.profile = out.user;
    renderProfileForm();
  },

  async addExperience(payload) {
    const out = await api("/profile/experiences", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
    ui.notify("Experiência cadastrada.");
  },

  async removeExperience(id) {
    const out = await api(`/profile/experiences/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    state.profile = out.user;
    renderProfileForm();
  },

  async addCourse(payload) {
    const out = await api("/profile/courses", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
    ui.notify("Curso cadastrado.");
  },

  async removeCourse(id) {
    const out = await api(`/profile/courses/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    state.profile = out.user;
    renderProfileForm();
  },

  async addCertification(payload) {
    const out = await api("/profile/certifications", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
    ui.notify("Certificação cadastrada.");
  },

  async removeCertification(id) {
    const out = await api(`/profile/certifications/${id}?profileId=${encodeURIComponent(state.activeProfileId)}`, { method: "DELETE" }, state.token);
    state.profile = out.user;
    renderProfileForm();
  },

  async match(jobDescription) {
    renderMatchLoading();
    const jobTitle = document.getElementById("match-job-title")?.value || "";
    const company = document.getElementById("match-company")?.value || "";
    const result = await api("/match", { method: "POST", body: JSON.stringify({ jobDescription, jobTitle, company, profileId: state.activeProfileId }) }, state.token);
    state.lastMatchResult = result;
    if (result.generatedPdf?.contentBase64) {
      state.optimizedPdfCache[result.id] = result.generatedPdf;
    }
    renderMatchResult(result);
    await career.loadHistory();
  },

  async removeMatch(id) {
    await api(`/optimized-resumes/${id}`, { method: "DELETE" }, state.token);
    await career.loadHistory();
  },

  async markAnalysisApplied(id) {
    const out = await api(`/job-analyses/${id}`, { method: "PATCH", body: JSON.stringify({ status: "applied" }) }, state.token);
    ui.notify(out.message);
    await career.loadHistory();
  },

  async openAnalysis(id) {
    const analysis = await api(`/job-analyses/${id}`, {}, state.token);
    state.lastMatchResult = {
      analysisId: analysis.id,
      targetTitle: analysis.jobTitle,
      selectedSubprofileName: analysis.selectedSubprofile?.profileName || "",
      score: analysis.matchScore,
    };
    renderAnalysisEditor(analysis);
  },

  async saveAnalysisVersion(id, payload) {
    const out = await api(`/job-analyses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }, state.token);
    ui.notify(out.message);
    await career.loadHistory();
    await career.openAnalysis(out.analysis.id);
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
    await jobs.load();
    await career.loadHistory();
    ui.notify("Candidatura registrada com sucesso. Você poderá acompanhar essa vaga no painel de candidaturas.");
    return out;
  },

  async loadResumeFiles() {
    const query = state.activeProfileId ? `?profileId=${encodeURIComponent(state.activeProfileId)}` : "";
    const files = await api(`/resume-files${query}`, {}, state.token);
    state.resumeFiles = Array.isArray(files) ? files : [];
    renderResumeFiles();
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
    renderResumeFiles();
    ui.notify("Currículo PDF anexado somente como referência.");
  },

  async removeResumeFile(id) {
    await api(`/resume-files/${id}`, { method: "DELETE" }, state.token);
    await career.loadResumeFiles();
  },

  async downloadResumeFile(id) {
    const { API_URL } = await import("./config.js");
    const response = await fetch(`${API_URL}/resume-files/${id}/download`, {
      headers: { Authorization: `Bearer ${state.token}` },
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
      headers: { Authorization: `Bearer ${state.token}` },
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
    const localPdf = state.optimizedPdfCache?.[id];
    if (localPdf?.contentBase64) {
      const binary = atob(localPdf.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = localPdf.fileName || "curriculo-otimizado.pdf";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      return;
    }

    const { API_URL } = await import("./config.js");
    const response = await fetch(`${API_URL}/optimized-resumes/${id}/download`, {
      headers: { Authorization: `Bearer ${state.token}` },
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
    localStorage.setItem("vagas_active_profile_id", profile.id);
    await career.loadProfiles();
    await career.loadProfile();
    await career.loadResumeFiles();
    await career.loadHistory();
    ui.notify("Perfil criado.");
  },

  async deleteProfile(profileId) {
    await api(`/profiles/${profileId}`, { method: "DELETE" }, state.token);
    if (state.activeProfileId === profileId) {
      state.activeProfileId = "";
      localStorage.removeItem("vagas_active_profile_id");
    }
    await career.loadProfiles();
    if (!state.profiles.some((profile) => profile.id === state.activeProfileId)) {
      state.activeProfileId = state.profiles.find((profile) => profile.isGlobal)?.id || state.profiles[0]?.id || "";
      if (state.activeProfileId) localStorage.setItem("vagas_active_profile_id", state.activeProfileId);
    }
    await career.loadProfile();
    await Promise.all([career.loadResumeFiles(), career.loadHistory()]);
    ui.notify("Subperfil removido.");
  },

  async switchProfile(profileId) {
    state.activeProfileId = profileId;
    localStorage.setItem("vagas_active_profile_id", profileId);
    renderProfileCards();
    await career.loadProfile();
    await career.loadResumeFiles();
    await career.loadHistory();
  },

  setTab(tab) {
    document.querySelectorAll("[data-dashboard-tab]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.dashboardTab === tab);
    });
    document.querySelectorAll("[data-dashboard-panel]").forEach((panel) => {
      panel.classList.toggle("hidden", panel.dataset.dashboardPanel !== tab);
    });
  },
};
