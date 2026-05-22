const { z } = require("zod");

const cleanString = (max = 500) => z.string().trim().max(max).default("");

const profileSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter pelo menos 3 caracteres").max(120),
  title: cleanString(160),
  emailContact: z.string().trim().email("E-mail de contato inválido").or(z.literal("")).default(""),
  phone: cleanString(60),
  location: cleanString(120),
  linkedin: cleanString(300),
  github: cleanString(300),
  summary: cleanString(3000),
});

const skillsSchema = z.object({
  skills: z
    .array(z.string().trim().min(1).max(80))
    .max(80, "Informe no máximo 80 habilidades")
    .default([]),
});

const projectSchema = z.object({
  title: z.string().trim().min(2, "Título do projeto é obrigatório").max(160),
  description: z.string().trim().min(10, "Descrição deve ter pelo menos 10 caracteres").max(3000),
  technologies: z
    .array(z.string().trim().min(1).max(80))
    .min(1, "Informe pelo menos uma tecnologia")
    .max(40, "Informe no máximo 40 tecnologias"),
});

const experienceSchema = z.object({
  company: z.string().trim().min(2, "Empresa é obrigatória").max(160),
  role: z.string().trim().min(2, "Cargo é obrigatório").max(160),
  period: z.string().trim().min(2, "Período é obrigatório").max(120),
  description: z.string().trim().min(10, "Descrição deve ter pelo menos 10 caracteres").max(3000),
});

const matchSchema = z.object({
  jobDescription: z
    .string()
    .trim()
    .min(30, "Cole uma descrição de vaga com pelo menos 30 caracteres")
    .max(15000, "A descrição da vaga deve ter no máximo 15.000 caracteres"),
  resumeFileId: z.string().uuid("Currículo PDF inválido").optional(),
});

module.exports = {
  profileSchema,
  skillsSchema,
  projectSchema,
  experienceSchema,
  matchSchema,
};
