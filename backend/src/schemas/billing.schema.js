const { z } = require("zod");
const { PLAN_KEYS } = require("../constants/subscription-plans");

const planSchema = z.enum(Object.values(PLAN_KEYS));

const paidPlanSchema = z.enum([PLAN_KEYS.PREMIUM]);

const checkoutSchema = z.object({
  plan: paidPlanSchema,
  couponCode: z.string().trim().max(80).optional(),
});

const billingCustomerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cpfCnpj: z.string().trim().refine((value) => {
    const d = value.replace(/\D/g, "");
    return d.length === 11 || d.length === 14;
  }, "CPF/CNPJ invalido"),
  email: z.string().trim().email("E-mail invalido"),
});

module.exports = { planSchema, paidPlanSchema, checkoutSchema, billingCustomerSchema };
