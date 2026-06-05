const subscriptionService = require("../services/subscription.service");
const billingService = require("../services/billing.service");
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
    const payload = billingCustomerSchema.parse(req.body);
    const result = await billingService.saveBillingProfile(req.userId, payload);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function asaasWebhook(req, res, next) {
  try {
    const token = req.headers["asaas-access-token"];
    const result = await billingService.processAsaasWebhook(req.body, token);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const result = await billingService.cancelSubscription(req.userId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
}

module.exports = { me, checkout, saveCustomer, cancel, asaasWebhook };
