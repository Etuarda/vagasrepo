const { z } = require("zod");

const cleanString = (max = 500) => z.string().trim().max(max).default("");
const emptyToUndefined = (value) => (value === "" || value === null ? undefined : value);
const optionalUuid = (message) => z.preprocess(emptyToUndefined, z.string().uuid(message).optional());
const senioritySchema = z.enum(["junior", "pleno", "senior", "lead", "specialist"], {
  errorMap: () => ({ message: "Senioridade e obrigatoria" }),
});

const profileSchema = z.object({
  profileName: z.string().trim().min(2, "Nome do perfil deve ter pelo menos 2 caracteres").max(80),
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(120),
  title: cleanString(160),
  emailContact: z.string().trim().email("E-mail de contato invalido").or(z.literal("")).default(""),
  phone: cleanString(60),
  location: cleanString(120),
  cep: z.string().trim().regex(/^$|^\d{5}-?\d{3}$/, "CEP invalido").default(""),
  linkedin: cleanString(300),
  github: cleanString(300),
  lattes: cleanString(300),
  summary: cleanString(2600),
  objective: z.string().trim().max(500).optional(),
  seniority: senioritySchema,
  category: z.string().trim().max(40).optional(),
});

const createProfileSchema = z.object({
  profileName: z.string().trim().min(2, "Nome do perfil deve ter pelo menos 2 caracteres").max(80),
});

const profileIdSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
});

const idParamSchema = z.object({
  id: z.string().uuid("ID invalido"),
});

const skillsSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  skills: z
    .array(z.string().trim().min(1).max(2000))
    .transform((items) => items.flatMap((item) => item.split(",").map((skill) => skill.trim()).filter(Boolean)))
    .pipe(z.array(z.string().min(1).max(80)).max(80, "Informe no maximo 80 habilidades"))
    .default([]),
});

const projectSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  title: z.string().trim().min(2, "Titulo do projeto e obrigatorio").max(160),
  category: cleanString(40),
  shortDescription: z.string().trim().min(10, "Resumo curto deve ter pelo menos 10 caracteres").max(500),
  stack: cleanString(500),
  repositoryUrl: z.string().trim().url("Link do repositorio invalido").or(z.literal("")).default(""),
  deployUrl: z.string().trim().url("Link do deploy invalido").or(z.literal("")).default(""),
});

const experienceSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  company: z.string().trim().min(2, "Empresa e obrigatoria").max(160),
  role: z.string().trim().min(2, "Cargo e obrigatorio").max(160),
  period: z.string().trim().min(2, "Periodo e obrigatorio").max(120),
  workload: cleanString(80),
  description: z.string().trim().min(10, "Descricao deve ter pelo menos 10 caracteres").max(3000),
});

const courseSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  title: z.string().trim().min(2, "Curso e obrigatorio").max(180),
  institution: cleanString(180),
  period: cleanString(120),
  workload: cleanString(80),
  description: cleanString(1000),
});

const certificationSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  title: z.string().trim().min(2, "Certificacao e obrigatoria").max(180),
  issuer: cleanString(180),
  period: cleanString(120),
  workload: cleanString(80),
  credentialUrl: z.string().trim().url("Link da credencial invalido").or(z.literal("")).default(""),
});

const languageSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  name: z.string().trim().min(2, "Idioma e obrigatorio").max(80),
  level: cleanString(80),
});

const educationSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  title: z.string().trim().min(2, "Curso e obrigatorio").max(180),
  institution: z.string().trim().min(2, "Instituicao e obrigatoria").max(180),
  period: cleanString(120),
});

const subprofileAllocationSchema = z.object({
  profileId: z.string().uuid("Subperfil invalido"),
  skillIds: z.array(z.string().uuid()).max(80).default([]),
  projectIds: z.array(z.string().uuid()).max(100).default([]),
  experienceIds: z.array(z.string().uuid()).max(100).default([]),
  courseIds: z.array(z.string().uuid()).max(100).default([]),
  certificationIds: z.array(z.string().uuid()).max(100).default([]),
  educationIds: z.array(z.string().uuid()).max(100).default([]),
  languageIds: z.array(z.string().uuid()).max(100).default([]),
  copyBaseProfile: z.boolean().default(false),
});

const matchSchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(30, "Cole uma descricao de vaga com pelo menos 30 caracteres")
    .max(15000, "A descricao da vaga deve ter no maximo 15.000 caracteres"),
  profileId: optionalUuid("Perfil invalido"),
  jobTitle: z.string().trim().min(2, "Cargo da vaga e obrigatorio").max(160),
  company: z.string().trim().min(2, "Empresa e obrigatoria").max(160),
  linkVaga: z.string().trim().url("Link da vaga invalido"),
});

const sharedMatchedJobsQuerySchema = z.object({
  period: z.preprocess(emptyToUndefined, z.enum(["day", "week", "month"]).default("month")),
});

const jobAnalysisUpdateSchema = z.object({
  status: z.enum(["draft", "reviewed", "applied", "archived", "rejected"]).optional(),
  notes: z.string().trim().max(3000).optional(),
  jobTitle: z.string().trim().min(2).max(160).optional(),
  company: z.string().trim().max(160).optional(),
  linkVaga: z.string().trim().url("Link da vaga invalido").or(z.literal("")).optional(),
  jobDescription: z.string().trim().min(30).max(15000).optional(),
});

module.exports = {
  profileSchema,
  createProfileSchema,
  profileIdSchema,
  idParamSchema,
  skillsSchema,
  projectSchema,
  experienceSchema,
  courseSchema,
  certificationSchema,
  languageSchema,
  educationSchema,
  subprofileAllocationSchema,
  matchSchema,
  sharedMatchedJobsQuerySchema,
  jobAnalysisUpdateSchema,
};
