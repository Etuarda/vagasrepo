const { z } = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatório"),
  CORS_ORIGIN: z.string().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `ENV inválida: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
  );
}

module.exports = parsed.data;
