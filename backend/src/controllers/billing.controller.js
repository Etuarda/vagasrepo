const subscriptionService = require("../services/subscription.service");
const billingService = require("../services/billing.service");
const creditsService = require("../services/credits.service");
const { checkoutSchema, billingCustomerSchema } = require("../schemas/billing.schema");

async function me(req, res, next) {
  try {
    const context = await subscriptionService.getPlanContext(req.userId);
    return res.json(context);
  } catch (err) {
    return next(err);
  }
}

async function checkout(req, res, next) {
  try {
    const payload = checkoutSchema.parse(req.body);
    const result = await billingService.createCheckout(req.userId, payload);
    return res.status(result.status === "active" ? 200 : 201).json(result);
  } catch (err) {
    return next(err);
  }
}

async function saveCustomer(req, res, next) {
  try {
    const { cpfCnpj } = billingCustomerSchema.parse(req.body);
    const result = await billingService.saveCustomerDocument(req.userId, cpfCnpj);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function asaasWebhook(req, res, next) {
  try {
    const token = req.query.token || req.headers["asaas-access-token"];
    const result = await billingService.processAsaasWebhook(req.body, token);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function creditsCheckout(req, res, next) {
  try {
    const result = await creditsService.createCreditsCheckout(req.userId);
    return res.status(201).json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { me, checkout, saveCustomer, asaasWebhook, creditsCheckout };
