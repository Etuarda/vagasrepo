const { z } = require("zod");

const cleanString = (max = 500) => z.string().trim().max(max).default("");
const emptyToUndefined = (value) => (value === "" || value === null ? undefined : value);
const optionalUuid = (message) => z.preprocess(emptyToUndefined, z.string().uuid(message).optional());

const profileSchema = z.object({
  profileName: z.string().trim().min(2, "Nome do perfil deve ter pelo menos 2 caracteres").max(80),
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(120),
  title: cleanString(160),
  emailContact: z.string().trim().email("E-mail de contato invalido").or(z.literal("")).default(""),
  phone: cleanString(60),
  location: cleanString(120),
  linkedin: cleanString(300),
  github: cleanString(300),
  summary: cleanString(3000),
});

const createProfileSchema = z.object({
  profileName: z.string().trim().min(2, "Nome do perfil deve ter pelo menos 2 caracteres").max(80),
});

const profileIdSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
});

const skillsSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  skills: z
    .array(z.string().trim().min(1).max(80))
    .max(80, "Informe no maximo 80 habilidades")
    .default([]),
});

const projectSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  title: z.string().trim().min(2, "Titulo do projeto e obrigatorio").max(160),
  description: z.string().trim().min(10, "Descricao deve ter pelo menos 10 caracteres").max(3000),
  technologies: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Informe pelo menos uma tecnologia")
    .max(40, "Informe no maximo 40 tecnologias"),
});

const experienceSchema = z.object({
  profileId: optionalUuid("Perfil invalido"),
  company: z.string().trim().min(2, "Empresa e obrigatoria").max(160),
  role: z.string().trim().min(2, "Cargo e obrigatorio").max(160),
  period: z.string().trim().min(2, "Periodo e obrigatorio").max(120),
  description: z.string().trim().min(10, "Descricao deve ter pelo menos 10 caracteres").max(3000),
});

const matchSchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(30, "Cole uma descricao de vaga com pelo menos 30 caracteres")
    .max(15000, "A descricao da vaga deve ter no maximo 15.000 caracteres"),
  resumeFileId: optionalUuid("Curriculo PDF invalido"),
  profileId: optionalUuid("Perfil invalido"),
});

module.exports = {
  profileSchema,
  createProfileSchema,
  profileIdSchema,
  skillsSchema,
  projectSchema,
  experienceSchema,
  matchSchema,
};
