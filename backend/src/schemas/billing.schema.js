const { z } = require("zod");
const { PLAN_KEYS } = require("../constants/subscription-plans");

const planSchema = z.enum(Object.values(PLAN_KEYS));

const updatePlanSchema = z.object({
  plan: planSchema,
});

module.exports = { planSchema, updatePlanSchema };
