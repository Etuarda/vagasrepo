const { z } = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  CORS_ORIGIN: z.string().optional(),
  NODE_ENV: z.string().default("development"),
  REDIS_URL: z.string().optional(),
  FRONTEND_URL: z.string().url().default("https://gestaodevagas.vercel.app"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `ENV inválida: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
  );
}

module.exports = parsed.data;
