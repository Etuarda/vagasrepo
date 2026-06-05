import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";

export const support = {
  init() {
    const form = document.getElementById("form-support");
    const messageInput = document.getElementById("support-message");
    const counter = document.getElementById("support-msg-count");

    if (messageInput && counter) {
      messageInput.addEventListener("input", () => {
        counter.textContent = messageInput.value.length;
      });
    }

    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const subject = document.getElementById("support-subject")?.value?.trim() || "";
      const message = document.getElementById("support-message")?.value?.trim() || "";

      if (subject.length < 3) { ui.notify("Assunto muito curto."); return; }
      if (message.length < 10) { ui.notify("Mensagem muito curta."); return; }

      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Enviando..."; }

      try {
        await api("/support", { method: "POST", body: JSON.stringify({ subject, message }) }, state.token);
        ui.notify("Mensagem enviada. Responderemos em breve pelo seu e-mail.");
        form.reset();
        if (counter) counter.textContent = "0";
      } catch (err) {
        ui.notify(err.message || "Erro ao enviar mensagem. Tente novamente.");
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = "Enviar mensagem"; }
      }
    });
  },
};
