const { z } = require("zod");

const StatusEnum = z.enum(["Ativa", "Pausada", "Encerrada"]);
const PeriodEnum = z.enum(["last7", "last30"]);

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

const jobListQuerySchema = z.object({
  q: z.preprocess(emptyToUndefined, z.string().trim().max(200).optional()),
  status: z.preprocess(emptyToUndefined, StatusEnum.optional()),
  period: z.preprocess(emptyToUndefined, PeriodEnum.optional()),
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

module.exports = { jobSchema, jobListQuerySchema, StatusEnum };
