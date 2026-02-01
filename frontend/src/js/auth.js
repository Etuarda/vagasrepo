import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";

export const auth = {
  async init(onLoggedIn) {
    ui.renderNav();

    if (!state.token) {
      ui.navigate("landing");
      return;
    }

    try {
      const user = await api("/auth/me", {}, state.token);
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

    state.token = token;
    state.user = user;
    localStorage.setItem("vagas_token", token);

    ui.closeAuthModal();
    ui.renderNav();
    ui.navigate("dashboard");

    onLoggedIn?.();
  },

  async register(name, email, password) {
    await api(
      "/auth/register",
      { method: "POST", body: JSON.stringify({ name, email, password }) },
      null
    );
    ui.notify("Conta criada. Por favor, acesse.");
    ui.switchAuth("login");
  },

  logout() {
    localStorage.removeItem("vagas_token");
    state.token = null;
    state.user = null;
    ui.renderNav();
    ui.navigate("landing");
  },
};
