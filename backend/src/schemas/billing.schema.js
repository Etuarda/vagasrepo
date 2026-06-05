const { z } = require("zod");
const { PLAN_KEYS } = require("../constants/subscription-plans");

function isValidCpf(value) {
  const d = value.replace(/\D/g, "");
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10]);
}

const planSchema = z.enum(Object.values(PLAN_KEYS));

const paidPlanSchema = z.enum([PLAN_KEYS.PREMIUM]);

const checkoutSchema = z.object({
  plan: paidPlanSchema,
  couponCode: z.string().trim().max(80).optional(),
});

const billingCustomerSchema = z.object({
  name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres"),
  cpfCnpj: z.string().trim().refine(isValidCpf, "CPF invalido"),
  email: z.string().trim().email("E-mail invalido"),
});

module.exports = { planSchema, paidPlanSchema, checkoutSchema, billingCustomerSchema, isValidCpf };
