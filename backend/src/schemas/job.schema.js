const { z } = require("zod");
const { JOB_STATUSES, APPLICATION_PHASES } = require("../constants/application-status");

const StatusEnum = z.enum(JOB_STATUSES);
const PeriodEnum = z.enum(["day", "week", "month", "currentMonth", "last7", "last30"]);
const ApplicationPhaseEnum = z.enum(APPLICATION_PHASES);

const emptyToUndefined = (v) => (v === "" || v === null ? undefined : v);

const jobSchema = z
  .object({
    titulo: z.string().min(1, "Titulo e obrigatorio"),
    empresa: z.string().min(1, "Empresa e obrigatoria"),
    linkVaga: z.string().url("linkVaga deve ser uma URL valida"),
    linkCV: z.string().trim().max(500, "linkCV deve ter no maximo 500 caracteres"),
    data: z.coerce.date(),
    status: StatusEnum,
    fase: ApplicationPhaseEnum,
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
        message: "Informe qual acao e necessaria",
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
    linkVaga: z.string().trim().url("linkVaga deve ser uma URL valida").or(z.literal("")).default(""),
    linkCV: z.string().trim().url("linkCV deve ser uma URL valida").or(z.literal("")).default(""),
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
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["qualAcao"], message: "Informe qual acao e necessaria" });
    }
    if (val.feedbackBool && !val.feedbackTxt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["feedbackTxt"], message: "Informe o feedback recebido" });
    }
  });

const jobListQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  titulo: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  empresa: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  linkVaga: z.preprocess(emptyToUndefined, z.string().trim().max(500).optional()),
  status: z.preprocess(emptyToUndefined, StatusEnum.optional()),
  fase: z.preprocess(emptyToUndefined, ApplicationPhaseEnum.optional()),
  subprofileId: z.preprocess(emptyToUndefined, z.string().uuid("subprofileId invalido").optional()),
  origin: z.preprocess(emptyToUndefined, z.enum(["manual", "matching"]).optional()),
  period: z.preprocess(emptyToUndefined, PeriodEnum.optional()),
  page: z.preprocess((v) => emptyToUndefined(v) ?? 1, z.coerce.number().int().min(1).max(1, "Use cursor para carregar a proxima pagina")),
  limit: z.preprocess((v) => emptyToUndefined(v) ?? 50, z.coerce.number().int().min(1).max(100)),
  cursor: z.preprocess(emptyToUndefined, z.string().uuid("cursor invalido").optional()),
  dateFrom: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateFrom deve ser YYYY-MM-DD").optional()
  ),
  dateTo: z.preprocess(
    emptyToUndefined,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "dateTo deve ser YYYY-MM-DD").optional()
  ),
});

const idParamSchema = z.object({
  id: z.string().uuid("ID invalido"),
});

module.exports = { jobSchema, jobListQuerySchema, createApplicationFromAnalysisSchema, idParamSchema, StatusEnum, ApplicationPhaseEnum };
