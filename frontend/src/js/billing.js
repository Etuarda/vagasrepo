import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";

const PLAN_NAMES = Object.freeze({
  free: "Free",
  premium: "Pro",
});

function isValidCpf(value) {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLimit(limit) {
  return limit === null ? "sem limite visivel" : limit;
}

function renderLimitCards(context) {
  const root = document.getElementById("billing-limits");
  if (!root) return;
  const matching = context.usage.matching;
  const subprofiles = context.usage.subprofiles;
  const tracking = context.usage.applicationTracking;
  const periodLabel = matching.period === "lifetime" ? "vitalicias" : "neste mes";
  root.innerHTML = [
    {
      title: "Matching",
      value: `${matching.used}/${matching.limit}`,
      detail: `${matching.remaining} restantes ${periodLabel}`,
    },
    {
      title: "Subperfis",
      value: `${subprofiles.used}/${subprofiles.limit}`,
      detail: subprofiles.limit > 0 ? `${subprofiles.remaining} restantes` : "Nao incluido no plano atual",
    },
    {
      title: "Acompanhamento",
      value: tracking.limit === null ? `${tracking.used}` : `${tracking.used}/${tracking.limit}`,
      detail: tracking.limit === null ? "sem limite visivel" : `${tracking.remaining} restantes`,
    },
  ].map((item) => `
    <article class="contrast-surface border border-borderLight rounded-2xl p-4">
      <p class="text-[10px] font-bold uppercase tracking-[0.25em] text-stone">${escapeHtml(item.title)}</p>
      <p class="font-serif text-3xl mt-2">${escapeHtml(item.value)}</p>
      <p class="text-xs text-taupe mt-1">${escapeHtml(item.detail)}</p>
    </article>
  `).join("");
}

function renderPlanCards(context) {
  const root = document.getElementById("billing-plan-cards");
  if (!root) return;
  root.innerHTML = (context.availablePlans || []).map((plan) => {
    const current = plan.key === context.plan;
    return `
      <article class="border border-borderLight rounded-2xl p-5 bg-white flex flex-col gap-4 ${current ? "ring-2 ring-ink" : ""}">
        <div>
          <p class="text-[10px] font-bold uppercase tracking-[0.25em] text-stone">${current ? "Plano atual" : "Plano disponivel"}</p>
          <h4 class="font-serif text-3xl mt-2">${escapeHtml(plan.name)}</h4>
          <p class="font-bold text-sm mt-1">${escapeHtml(plan.priceLabel)}</p>
          <p class="text-xs text-taupe mt-2">${escapeHtml(plan.description)}</p>
        </div>
        <ul class="space-y-2 text-xs text-taupe leading-relaxed">
          ${(plan.benefits || []).map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join("")}
        </ul>
        <p class="text-[10px] uppercase tracking-[0.2em] text-stone mt-auto">
          ${plan.rules.matchingLimit} matchings ${plan.rules.matchingPeriod === "lifetime" ? "vitalicios" : "por mes"} · ${formatLimit(plan.rules.maxSubprofiles)} subperfis
        </p>
      </article>
    `;
  }).join("");
}

function syncSubprofileCreation(context) {
  const form = document.getElementById("form-create-profile");
  if (!form) return;
  const input = document.getElementById("new-profile-name");
  const button = form.querySelector('button[type="submit"]');
  const usage = context.usage.subprofiles;
  const allowed = usage.limit > 0 && usage.remaining > 0;
  const messageId = "subprofile-plan-limit";
  let message = document.getElementById(messageId);
  if (!message) {
    message = document.createElement("p");
    message.id = messageId;
    message.className = "text-xs text-taupe sm:col-span-2";
    form.appendChild(message);
  }
  message.textContent = usage.limit > 0
    ? `Subperfis do plano: ${usage.used}/${usage.limit}. Restam ${usage.remaining}.`
    : "Seu plano atual nao permite criar subperfis.";
  if (input) input.disabled = !allowed;
  if (button) {
    button.disabled = !allowed;
    button.classList.toggle("opacity-50", !allowed);
    button.classList.toggle("cursor-not-allowed", !allowed);
  }
}

function showPixSection(data) {
  if (!data.pixQrCodeImage || !data.pixCopyPaste) {
    ui.notify("Erro ao gerar QR Code Pix. Tente novamente ou entre em contato com o suporte.");
    return;
  }
  const section = document.getElementById("billing-pix-section");
  const qrcode = document.getElementById("billing-pix-qrcode");
  const copypaste = document.getElementById("billing-pix-copypaste");
  if (!section) return;
  if (qrcode) qrcode.src = `data:image/png;base64,${data.pixQrCodeImage}`;
  if (copypaste) copypaste.value = data.pixCopyPaste;
  section.classList.remove("hidden");
  section.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function renderBillingProfile(context) {
  const display = document.getElementById("billing-profile-display");
  const nameInput = document.getElementById("billing-name");
  const emailInput = document.getElementById("billing-email");
  const cpfInput = document.getElementById("billing-cpf-cnpj");
  const profile = context.billingProfile;
  if (!profile) return;

  const hasAll = profile.name && profile.email && profile.cpfCnpj;
  if (display) {
    display.innerHTML = hasAll
      ? `<p><strong>Nome:</strong> ${escapeHtml(profile.name)}</p>
         <p><strong>E-mail:</strong> ${escapeHtml(profile.email)}</p>
         <p><strong>CPF/CNPJ:</strong> ${escapeHtml(profile.cpfCnpj)}</p>`
      : `<p class="text-amber-700">Preencha os dados abaixo para gerar a cobranca.</p>`;
  }
  if (nameInput && profile.name) nameInput.value = profile.name;
  if (emailInput && profile.email) emailInput.value = profile.email;
  if (cpfInput && profile.cpfCnpj) cpfInput.value = profile.cpfCnpj;
}

function isRefundEligible(context) {
  if (context.plan !== "premium" || context.subscription?.status !== "active") return false;
  if (context.subscription?.provider !== "asaas") return false;
  const start = context.subscription?.currentPeriodStart;
  if (!start) return false;
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - new Date(start).getTime() <= sevenDaysMs;
}

function renderRefundSection(context) {
  const section = document.getElementById("billing-refund-section");
  if (!section) return;
  section.classList.toggle("hidden", !isRefundEligible(context));
}

function renderCancelSection(context) {
  const section = document.getElementById("billing-cancel-section");
  if (!section) return;
  const isActivePro = context.plan === "premium" && context.subscription?.status === "active";
  section.classList.toggle("hidden", !isActivePro);
}

function render() {
  const context = state.billing;
  if (!context) return;

  const planName = PLAN_NAMES[context.plan] || context.plan;
  const current = document.getElementById("billing-current-plan");
  const usage = document.getElementById("billing-usage");
  const status = document.getElementById("billing-status");
  const select = document.getElementById("billing-plan");
  if (current) current.textContent = `Plano atual: ${planName}`;
  if (status) {
    const pending = context.subscription?.pendingPlan;
    const statusText = context.subscription?.status || "active";
    status.textContent = pending
      ? `Status: ${statusText}. Assinatura ${PLAN_NAMES[pending] || pending} aguardando confirmacao de pagamento.`
      : `Status: ${statusText}.`;
  }
  if (usage) {
    const matching = context.usage.matching;
    const tracking = context.usage.applicationTracking;
    const trackingText = tracking.limit === null
      ? "acompanhamento de vagas sem limite visivel"
      : `${tracking.used}/${tracking.limit} vagas acompanhadas`;
    usage.textContent = `${matching.used}/${matching.limit} analises (${matching.period === "lifetime" ? "vitalicias" : "neste mes"}) | ${trackingText}`;
  }
  if (select) select.value = context.subscription?.pendingPlan || (context.plan === "free" ? "premium" : context.plan);
  renderLimitCards(context);
  renderPlanCards(context);
  renderBillingProfile(context);
  renderRefundSection(context);
  renderCancelSection(context);
  syncSubprofileCreation(context);
}

export const billing = {
  async load() {
    state.billing = await api("/billing/me", {}, state.token);
    render();
    return state.billing;
  },

  async saveCustomer({ name, cpfCnpj, email }) {
    if (!name?.trim() || name.trim().length < 2) {
      ui.notify("Informe o nome completo.");
      return null;
    }
    if (!isValidCpf(cpfCnpj || "")) {
      ui.notify("CPF invalido. Verifique os digitos.");
      return null;
    }
    if (!email?.includes("@")) {
      ui.notify("Informe um e-mail valido.");
      return null;
    }
    const result = await api(
      "/billing/customer",
      { method: "PUT", body: JSON.stringify({ name: name.trim(), cpfCnpj, email: email.trim() }) },
      state.token
    );
    await this.load();
    ui.notify("Dados de cobranca salvos.");
    return result;
  },

  async checkout(plan, couponCode) {
    const body = { plan };
    if (couponCode?.trim()) body.couponCode = couponCode.trim();
    const result = await api(
      "/billing/checkout",
      { method: "POST", body: JSON.stringify(body) },
      state.token
    );
    if (result.status === "active") {
      await this.load();
      ui.notify("Plano ativado com cupom.");
      return result;
    }
    showPixSection(result);
    ui.notify("QR Code Pix gerado. Escaneie para pagar e ativar o plano.");
    return result;
  },

  initPixCopyEvent() {
    const copyBtn = document.getElementById("btn-copy-pix");
    if (copyBtn) {
      copyBtn.addEventListener("click", () => {
        const copypaste = document.getElementById("billing-pix-copypaste");
        if (!copypaste?.value) return;
        navigator.clipboard.writeText(copypaste.value).then(() => {
          ui.notify("Codigo Pix copiado!");
        });
      });
    }

    const refundBtn = document.getElementById("btn-request-refund");
    const refundConfirm = document.getElementById("billing-refund-confirm");
    const refundConfirmBtn = document.getElementById("btn-refund-confirm");
    const refundAbortBtn = document.getElementById("btn-refund-abort");

    if (refundBtn && refundConfirm) {
      refundBtn.addEventListener("click", () => {
        refundConfirm.classList.remove("hidden");
        refundBtn.classList.add("hidden");
        refundConfirm.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
    if (refundAbortBtn && refundConfirm && refundBtn) {
      refundAbortBtn.addEventListener("click", () => {
        refundConfirm.classList.add("hidden");
        refundBtn.classList.remove("hidden");
        const reasonInput = document.getElementById("refund-reason");
        if (reasonInput) reasonInput.value = "";
      });
    }
    if (refundConfirmBtn) {
      refundConfirmBtn.addEventListener("click", () => this.requestRefund());
    }

    const cancelBtn = document.getElementById("btn-cancel-subscription");
    const confirmSection = document.getElementById("billing-cancel-confirm");
    const confirmBtn = document.getElementById("btn-cancel-confirm");
    const abortBtn = document.getElementById("btn-cancel-abort");

    if (cancelBtn && confirmSection) {
      cancelBtn.addEventListener("click", () => {
        confirmSection.classList.remove("hidden");
        cancelBtn.classList.add("hidden");
        confirmSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }

    if (abortBtn && confirmSection && cancelBtn) {
      abortBtn.addEventListener("click", () => {
        confirmSection.classList.add("hidden");
        cancelBtn.classList.remove("hidden");
      });
    }

    if (confirmBtn) {
      confirmBtn.addEventListener("click", () => this.cancelSubscription());
    }
  },

  async requestRefund() {
    const confirmBtn = document.getElementById("btn-refund-confirm");
    const abortBtn = document.getElementById("btn-refund-abort");
    const reasonInput = document.getElementById("refund-reason");
    const reason = reasonInput?.value?.trim() || "";

    if (reason.length < 5) {
      ui.notify("Informe o motivo do estorno (minimo 5 caracteres).");
      return;
    }

    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "Processando..."; }
    if (abortBtn) abortBtn.disabled = true;
    try {
      await api("/billing/refund", { method: "POST", body: JSON.stringify({ reason }) }, state.token);
      await this.load();
      ui.notify("Estorno solicitado. O valor sera devolvido em ate 7 dias uteis.");
    } catch (err) {
      ui.notify(err.message || "Erro ao solicitar estorno.");
      const refundConfirm = document.getElementById("billing-refund-confirm");
      const refundBtn = document.getElementById("btn-request-refund");
      if (refundConfirm) refundConfirm.classList.add("hidden");
      if (refundBtn) refundBtn.classList.remove("hidden");
    } finally {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Confirmar estorno"; }
      if (abortBtn) abortBtn.disabled = false;
    }
  },

  async cancelSubscription() {
    const confirmBtn = document.getElementById("btn-cancel-confirm");
    const abortBtn = document.getElementById("btn-cancel-abort");
    if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = "Cancelando..."; }
    if (abortBtn) abortBtn.disabled = true;
    try {
      await api("/billing/cancel", { method: "POST" }, state.token);
      await this.load();
      ui.notify("Assinatura cancelada. Voce mantem o acesso ate o fim do periodo pago.");
    } catch (err) {
      ui.notify(err.message || "Erro ao cancelar assinatura.");
      const confirmSection = document.getElementById("billing-cancel-confirm");
      const cancelBtn = document.getElementById("btn-cancel-subscription");
      if (confirmSection) confirmSection.classList.add("hidden");
      if (cancelBtn) cancelBtn.classList.remove("hidden");
    } finally {
      if (confirmBtn) { confirmBtn.disabled = false; confirmBtn.textContent = "Confirmar cancelamento"; }
      if (abortBtn) abortBtn.disabled = false;
    }
  },
};
