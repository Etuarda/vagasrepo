import { api } from "./http.js";
import { state } from "./state.js";
import { ui } from "./ui.js";

const PLAN_NAMES = Object.freeze({
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  premium: "Premium",
});

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
  if (select) select.value = context.subscription?.pendingPlan || (context.plan === "free" ? "basic" : context.plan);
}

export const billing = {
  async load() {
    state.billing = await api("/billing/me", {}, state.token);
    render();
    return state.billing;
  },

  async saveCustomer(cpfCnpj) {
    const result = await api(
      "/billing/customer",
      { method: "PUT", body: JSON.stringify({ cpfCnpj }) },
      state.token
    );
    ui.notify("CPF/CNPJ salvo para cobranca.");
    return result;
  },

  async checkout(plan, couponCode) {
    const body = { plan };
    if (couponCode.trim()) body.couponCode = couponCode.trim();
    const result = await api(
      "/billing/checkout",
      { method: "POST", body: JSON.stringify(body) },
      state.token
    );
    if (result.invoiceUrl) {
      window.location.href = result.invoiceUrl;
      return result;
    }
    await this.load();
    ui.notify(result.status === "active" ? "Plano ativado com cupom." : "Assinatura criada. Aguarde a geracao da cobranca pelo Asaas.");
    return result;
  },
};
