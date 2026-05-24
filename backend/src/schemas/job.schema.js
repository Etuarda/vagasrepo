const { z } = require("zod");

const StatusEnum = z.enum(["Ativa", "Pausada", "Encerrada"]);
const PeriodEnum = z.enum(["last7", "last30"]);
const ApplicationPhaseEnum = z.enum(["Currículo gerado", "Aplicada", "Entrevista", "Teste técnico", "Feedback", "Encerrada"]);

const emptyToUndefined = (v) => (v === "" || v === null ? undefined : v);

const jobSchema = z
  .object({
    titulo: z.string().min(1, "Título é obrigatório"),
    empresa: z.string().min(1, "Empresa é obrigatória"),
    linkVaga: z.string().url("linkVaga deve ser uma URL válida"),

    // Aceita texto livre (ex: "enviar por e-mail", "link no LinkedIn", "Google Drive", etc.)
    linkCV: z.string().trim().max(500, "linkCV deve ter no máximo 500 caracteres"),

    // aceita "YYYY-MM-DD" vindo do input date
    data: z.coerce.date(),

    status: StatusEnum,
    fase: z.string().min(1, "Fase é obrigatória"),

    acaoNecessaria: z.boolean(),
    qualAcao: z.string().min(1).optional(),
    prazoAcao: z.coerce.date().optional(),

    feedbackBool: z.boolean(),
    feedbackTxt: z.string().min(1).optional(),
    notes: z.string().trim().max(3000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.acaoNecessaria && !val.qualAcao) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["qualAcao"],
        message: "Informe qual ação é necessária",
      });
    }
    if (val.feedbackBool && !val.feedbackTxt) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["feedbackTxt"],
        message: "Informe o feedback recebido",
      });
    }
  });

const createApplicationFromAnalysisSchema = z
  .object({
    linkVaga: z.string().trim().url("linkVaga deve ser uma URL válida"),
    linkCV: z.string().trim().url("linkCV deve ser uma URL válida").or(z.literal("")).default(""),
    fase: ApplicationPhaseEnum.default("Currículo gerado"),
    acaoNecessaria: z.boolean().default(false),
    qualAcao: z.string().trim().max(1000).optional().default(""),
    prazoAcao: z.preprocess(emptyToUndefined, z.coerce.date().optional()),
    feedbackBool: z.boolean().default(false),
    feedbackTxt: z.string().trim().max(3000).optional().default(""),
    notes: z.string().trim().max(3000).optional().default(""),
    confirmDuplicate: z.boolean().optional().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.acaoNecessaria && !val.qualAcao) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["qualAcao"], message: "Informe qual ação é necessária" });
    }
    if (val.feedbackBool && !val.feedbackTxt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["feedbackTxt"], message: "Informe o feedback recebido" });
    }
  });

const jobListQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  status: z.preprocess(emptyToUndefined, StatusEnum.optional()),
  period: z.preprocess(emptyToUndefined, PeriodEnum.optional()),
  page: z.preprocess((v) => emptyToUndefined(v) ?? 1, z.coerce.number().int().min(1).max(1000)),
  limit: z.preprocess((v) => emptyToUndefined(v) ?? 50, z.coerce.number().int().min(1).max(100)),
  dateFrom: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "dateFrom deve ser YYYY-MM-DD")
      .optional()
  ),
  dateTo: z.preprocess(
    emptyToUndefined,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "dateTo deve ser YYYY-MM-DD")
      .optional()
  ),
});

const idParamSchema = z.object({
  id: z.string().uuid("ID invalido"),
});

module.exports = { jobSchema, jobListQuerySchema, createApplicationFromAnalysisSchema, idParamSchema, StatusEnum, ApplicationPhaseEnum };
