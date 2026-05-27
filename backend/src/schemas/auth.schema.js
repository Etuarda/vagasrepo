const { z } = require("zod");

const emailSchema = z.string().trim().toLowerCase().email("E-mail invalido");
const passwordSchema = z.string().min(10, "Senha deve ter pelo menos 10 caracteres").max(128);
const phoneSchema = z.string()
  .trim()
  .min(10, "Telefone e obrigatorio")
  .max(25, "Telefone invalido")
  .refine((value) => value.replace(/\D/g, "").length >= 10, "Telefone invalido");

const registerSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(120),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
});

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Senha e obrigatoria"),
});

const forgotPasswordSchema = z.object({
  email: emailSchema,
});

const resetPasswordSchema = z.object({
  token: z.string().trim().min(32, "Link de recuperacao invalido"),
  password: passwordSchema,
});

module.exports = { registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema };
