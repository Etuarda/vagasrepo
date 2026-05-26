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
  const select = document.getElementById("billing-plan");
  if (current) current.textContent = `Plano atual: ${planName}`;
  if (usage) {
    const matching = context.usage.matching;
    const tracking = context.usage.applicationTracking;
    const trackingText = tracking.limit === null
      ? "acompanhamento de vagas sem limite visivel"
      : `${tracking.used}/${tracking.limit} vagas acompanhadas`;
    usage.textContent = `${matching.used}/${matching.limit} analises (${matching.period === "lifetime" ? "vitalicias" : "neste mes"}) | ${trackingText}`;
  }
  if (select) select.value = context.plan;
}

export const billing = {
  async load() {
    state.billing = await api("/billing/me", {}, state.token);
    render();
    return state.billing;
  },

  async updatePlan(plan) {
    state.billing = await api(
      "/billing/me",
      { method: "PATCH", body: JSON.stringify({ plan }) },
      state.token
    );
    render();
    ui.notify(`Plano atualizado para ${PLAN_NAMES[plan] || plan}.`);
    return state.billing;
  },
};
