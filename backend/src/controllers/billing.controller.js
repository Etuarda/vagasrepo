const subscriptionService = require("../services/subscription.service");

async function me(req, res, next) {
  try {
    const context = await subscriptionService.getPlanContext(req.userId);
    return res.json(context);
  } catch (err) {
    return next(err);
  }
}

module.exports = { me };
