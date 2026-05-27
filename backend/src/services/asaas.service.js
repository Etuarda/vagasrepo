const env = require("../config/env");

const ASAAS_BASE_URLS = Object.freeze({
  sandbox: "https://api-sandbox.asaas.com/v3",
  production: "https://api.asaas.com/v3",
});

function integrationError(message, statusCode = 502) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = "ASAAS_ERROR";
  return err;
}

async function requestAsaas(endpoint, options = {}) {
  if (!env.ASAAS_API_KEY) {
    throw integrationError("Integracao Asaas nao configurada.", 503);
  }
  const response = await fetch(`${ASAAS_BASE_URLS[env.ASAAS_ENV]}${endpoint}`, {
    method: options.method || "GET",
    headers: {
      access_token: env.ASAAS_API_KEY,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const providerMessage = payload.errors?.[0]?.description;
    throw integrationError(providerMessage || "Nao foi possivel concluir a cobranca no Asaas.", response.status >= 500 ? 502 : 400);
  }
  return payload;
}

function createCustomer({ name, email, cpfCnpj, mobilePhone }) {
  return requestAsaas("/customers", {
    method: "POST",
    body: { name, email, cpfCnpj, mobilePhone },
  });
}

function createSubscription({ customerId, plan, value, description, billingType = "UNDEFINED" }) {
  const callback = env.ASAAS_SUCCESS_URL
    ? { successUrl: env.ASAAS_SUCCESS_URL, autoRedirect: true }
    : undefined;
  return requestAsaas("/subscriptions", {
    method: "POST",
    body: {
      customer: customerId,
      billingType,
      value,
      nextDueDate: new Date().toISOString().slice(0, 10),
      cycle: "MONTHLY",
      description,
      externalReference: plan,
      ...(callback ? { callback } : {}),
    },
  });
}

function getSubscriptionPayments(subscriptionId) {
  return requestAsaas(`/subscriptions/${encodeURIComponent(subscriptionId)}/payments?offset=0&limit=1`);
}

module.exports = {
  requestAsaas,
  createCustomer,
  createSubscription,
  getSubscriptionPayments,
};
