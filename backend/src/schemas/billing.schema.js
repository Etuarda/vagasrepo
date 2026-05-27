const { z } = require("zod");
const { PLAN_KEYS } = require("../constants/subscription-plans");

const planSchema = z.enum(Object.values(PLAN_KEYS));

const paidPlanSchema = z.enum([PLAN_KEYS.BASIC, PLAN_KEYS.PRO, PLAN_KEYS.PREMIUM]);

const checkoutSchema = z.object({
  plan: paidPlanSchema,
  couponCode: z.string().trim().max(80).optional(),
});

const billingCustomerSchema = z.object({
  cpfCnpj: z.string().trim().refine((value) => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 11 || digits.length === 14;
  }, "CPF/CNPJ invalido"),
});

module.exports = { planSchema, paidPlanSchema, checkoutSchema, billingCustomerSchema };
