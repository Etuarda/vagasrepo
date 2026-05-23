const { z } = require("zod");

const emailSchema = z.string().trim().toLowerCase().email("E-mail invalido");

const registerSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(120),
  email: emailSchema,
  password: z.string().min(10, "Senha deve ter pelo menos 10 caracteres"),
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha e obrigatoria"),
});

module.exports = { registerSchema, loginSchema };
