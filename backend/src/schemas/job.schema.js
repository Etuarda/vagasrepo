const { z } = require("zod");

const StatusEnum = z.enum(["Ativa", "Pausada", "Encerrada"]);

const jobSchema = z
  .object({
    titulo: z.string().min(1, "Título é obrigatório"),
    empresa: z.string().min(1, "Empresa é obrigatória"),
    linkVaga: z.string().url("linkVaga deve ser uma URL válida"),
    linkCV: z.string().url("linkCV deve ser uma URL válida"),

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

module.exports = { jobSchema, StatusEnum };
