import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";

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
            </div>
            <button type="button" data-remove-project="${project.id}" class="text-[10px] font-bold uppercase tracking-widest text-red-700">Remover</button>
          </div>
          <div class="flex flex-wrap gap-2 mt-4">
            ${(project.technologies || []).map((tech) => `<span class="tag-pill">${escapeHtml(tech)}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");
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
  setValue("profile-summary", profile.summary);

  renderSkills();
  renderProjects();
  renderExperiences();
}

function renderProfileSelect() {
  const select = document.getElementById("career-profile-select");
  if (!select) return;

  select.innerHTML = (state.profiles || [])
    .map((profile) => `<option value="${profile.id}">${escapeHtml(profile.profileName)}</option>`)
    .join("");

  if (state.activeProfileId) select.value = state.activeProfileId;
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
              <h4 class="font-bold text-sm">${escapeHtml(item.targetTitle)}</h4>
              <p class="text-[10px] uppercase tracking-[0.2em] text-stone mt-1">${formatDateTime(item.createdAt)} · ${item.score}%</p>
              ${
                item.resumeFileId
                  ? `
                    <div class="mt-2 flex flex-wrap gap-3">
                      <a href="#" data-download-optimized="${item.id}" class="text-[10px] font-bold uppercase tracking-widest underline">Baixar PDF otimizado</a>
                      <a href="#" data-download-resume="${item.resumeFileId}" class="text-[10px] font-bold uppercase tracking-widest underline">PDF original</a>
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
  const select = document.getElementById("match-resume-file");
  const files = state.resumeFiles || [];

  if (select) {
    select.innerHTML = `
      <option value="">Usar apenas perfil cadastrado</option>
      ${files.map((file) => `<option value="${file.id}">${escapeHtml(file.fileName)}</option>`).join("")}
    `;
  }

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
                ${formatDateTime(file.createdAt)} · ${Math.round(file.sizeBytes / 1024)} KB · ${file.extractedTextLength ? "texto lido" : "sem texto extraído"}
              </p>
              <a href="#" data-download-resume="${file.id}" class="inline-block mt-3 text-[10px] font-bold uppercase tracking-widest underline">
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
        <div class="grid grid-cols-3 gap-3 text-center">
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.skillsMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Skills</span></div>
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.technologiesMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Tech</span></div>
          <div class="border border-borderLight rounded-2xl p-4"><span class="block text-xl font-bold">${result.scoreDetails.semanticMatchScore}%</span><span class="text-[9px] uppercase tracking-widest">Perfil</span></div>
        </div>
      </div>
      <p class="text-sm text-taupe leading-relaxed mt-6">${escapeHtml(result.semanticFeedback)}</p>
      <div class="mt-6 flex flex-wrap gap-3">
        ${
          result.generatedPdfAvailable
            ? `<button type="button" data-download-current-optimized="${result.id}" class="bg-ink text-paper px-6 py-3 rounded-full text-[10px] font-bold uppercase tracking-[0.25em]">Baixar curriculo atualizado</button>`
            : `<p class="text-sm text-taupe">Selecione um currículo-base em PDF antes do matching para gerar o currículo atualizado para aplicar na vaga.</p>`
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
      ${block("Tecnologias aderentes", result.matchedTechnologies || [], true)}
      ${block("Tecnologias ausentes", result.missingTechnologies || [])}
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
              </article>
            `
          )
          .join("") || `<p class="text-sm text-taupe">Cadastre projetos para melhorar a seleção automática.</p>`}
      </div>
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
    renderProfileSelect();
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

  async addProject(payload) {
    const out = await api("/profile/projects", { method: "POST", body: JSON.stringify({ ...payload, profileId: state.activeProfileId }) }, state.token);
    state.profile = out.user;
    renderProfileForm();
    ui.notify("Projeto cadastrado.");
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

  async match(jobDescription) {
    const resumeFileId = document.getElementById("match-resume-file")?.value || undefined;
    const result = await api("/match", { method: "POST", body: JSON.stringify({ jobDescription, resumeFileId, profileId: state.activeProfileId }) }, state.token);
    renderMatchResult(result);
    await career.loadHistory();
  },

  async removeMatch(id) {
    await api(`/optimized-resumes/${id}`, { method: "DELETE" }, state.token);
    await career.loadHistory();
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
    if (out.profile) state.profile = out.profile;
    renderResumeFiles();
    renderProfileForm();
    ui.notify("Currículo PDF anexado.");
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

  async downloadOptimizedResume(id) {
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

  async switchProfile(profileId) {
    state.activeProfileId = profileId;
    localStorage.setItem("vagas_active_profile_id", profileId);
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
