import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";

export const auth = {
  async init(onLoggedIn) {
    ui.renderNav();
    localStorage.removeItem("vagas_token");

    try {
      const user = await api("/auth/me", { silent: true }, state.token);
      state.user = user;
      ui.renderNav();
      ui.navigate("dashboard");
      onLoggedIn?.();
    } catch {
      auth.logout();
    }
  },

  async login(email, password, onLoggedIn) {
    const { token, user } = await api(
      "/auth/login",
      { method: "POST", body: JSON.stringify({ email, password }) },
      null
    );

    state.token = token || null;
    if (token) sessionStorage.setItem("vagas_legacy_token", token);
    else sessionStorage.removeItem("vagas_legacy_token");
    state.user = user;

    ui.closeAuthModal();
    ui.renderNav();
    ui.navigate("dashboard");

    onLoggedIn?.();
  },

  async register(name, email, phone, password) {
    await api(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ name, email, phone, password }) },
      null
    );
    ui.notify("Conta criada. Por favor, acesse.");
    ui.switchAuth("login");
  },

  async requestPasswordReset(email) {
    const out = await api(
      "/auth/forgot-password",
      { method: "POST", body: JSON.stringify({ email }) },
      null
    );
    ui.notify(out.message);
    ui.switchAuth("login");
    return out;
  },

  async resetPassword(token, password) {
    const out = await api(
      "/auth/reset-password",
      { method: "POST", body: JSON.stringify({ token, password }) },
      null
    );
    ui.notify(out.message);
    const url = new URL(window.location.href);
    url.searchParams.delete("resetToken");
    window.history.replaceState({}, "", url);
    ui.switchAuth("login");
  },

  logout() {
  api("/auth/logout", { method: "POST", silent: true }, state.token).catch(() => {});
    localStorage.removeItem("vagas_token");
    sessionStorage.removeItem("vagas_legacy_token");
    state.token = null;
    state.user = null;
    state.billing = null;
    state.jobs = [];
    state.profile = null;
    state.profiles = [];
    state.activeProfileId = "";
    state.matchHistory = [];
    state.sharedMatchedJobs = [];
    state.sharedMatchedJobsPeriod = "month";
    state.pendingApplicationAnalysis = null;
    state.lastMatchResult = null;
    state.resumeFiles = [];
    ui.renderNav();
    ui.navigate("landing");
  },
};
