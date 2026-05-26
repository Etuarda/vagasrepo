const subscriptionService = require("../services/subscription.service");
const { updatePlanSchema } = require("../schemas/billing.schema");

async function me(req, res, next) {
  try {
    const context = await subscriptionService.getPlanContext(req.userId);
    return res.json(context);
  } catch (err) {
    return next(err);
  }
}

async function update(req, res, next) {
  try {
    const { plan } = updatePlanSchema.parse(req.body);
    const context = await subscriptionService.updatePlan(req.userId, plan);
    return res.json(context);
  } catch (err) {
    return next(err);
  }
}

module.exports = { me, update };
