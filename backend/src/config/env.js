const { z } = require("zod");

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z.string().min(32, "JWT_SECRET deve ter pelo menos 32 caracteres"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL e obrigatorio"),
  CORS_ORIGIN: z.string().optional(),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  REDIS_URL: z.string().optional(),
  FRONTEND_URL: z.string().url().default("https://gestaodevagas.vercel.app"),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  RESEND_TEST_RECIPIENT: z.string().trim().toLowerCase().email().optional(),
  ASAAS_ENV: z.enum(["sandbox", "production"]).default("production"),
  ASAAS_API_KEY: z.string().optional(),
  ASAAS_WEBHOOK_TOKEN: z.string().optional(),
  ASAAS_SUCCESS_URL: z.string().url().optional(),
  ASAAS_FAILURE_URL: z.string().url().optional(),
  SUPPORT_EMAIL: z.string().email().default("eduardadeveloperr@gmail.com"),
  CPF_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
}).superRefine((data, ctx) => {
  if (data.ASAAS_ENV === "production") {
    if (!data.ASAAS_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ASAAS_API_KEY"],
        message: "ASAAS_API_KEY e obrigatorio quando ASAAS_ENV=production",
      });
    }
    if (!data.ASAAS_WEBHOOK_TOKEN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ASAAS_WEBHOOK_TOKEN"],
        message: "ASAAS_WEBHOOK_TOKEN e obrigatorio quando ASAAS_ENV=production",
      });
    }
    if (!data.CORS_ORIGIN) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CORS_ORIGIN"],
        message: "CORS_ORIGIN e obrigatorio quando ASAAS_ENV=production",
      });
    }
    if (!data.CPF_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CPF_ENCRYPTION_KEY"],
        message: "CPF_ENCRYPTION_KEY (64 hex chars) e obrigatorio quando ASAAS_ENV=production",
      });
    }
  }
  if (data.EMAIL_FROM && !data.RESEND_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["RESEND_API_KEY"],
      message: "RESEND_API_KEY e obrigatorio quando EMAIL_FROM esta definido",
    });
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `ENV invalida: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`
  );
}

module.exports = parsed.data;
