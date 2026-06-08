const { prisma } = require("../lib/prisma");
const cache = require("../lib/cache");
const { normalizeTerm } = require("../modules/matching/keyword-normalizer");
const subscriptionService = require("./subscription.service");

const skillSelect = { id: true, name: true, normalizedName: true, category: true };
const projectSelect = {
  id: true,
  title: true,
  category: true,
  shortDescription: true,
  stack: true,
  learnedSkills: true,
  repositoryUrl: true,
  deployUrl: true,
};
const experienceSelect = { id: true, company: true, role: true, period: true, workload: true, description: true };
const courseSelect = { id: true, title: true, institution: true, period: true, workload: true, description: true, learnedSkills: true };
const certificationSelect = { id: true, title: true, issuer: true, period: true, workload: true, credentialUrl: true, learnedSkills: true };
const languageSelect = { id: true, name: true, level: true };
const educationSelect = { id: true, title: true, institution: true, period: true, learnedSkills: true };

const globalCatalogInclude = {
  skills: { orderBy: { name: "asc" }, select: skillSelect },
  projects: { orderBy: { createdAt: "desc" }, select: projectSelect },
  experiences: { orderBy: { createdAt: "desc" }, select: experienceSelect },
  courses: { orderBy: { createdAt: "desc" }, select: courseSelect },
  certifications: { orderBy: { createdAt: "desc" }, select: certificationSelect },
  languages: { orderBy: { createdAt: "desc" }, select: languageSelect },
  educations: { orderBy: { createdAt: "desc" }, select: educationSelect },
};

const profileInclude = {
  ...globalCatalogInclude,
  subprofileSkills: { where: { isVisible: true }, select: { skillId: true, relevanceWeight: true, skill: { select: skillSelect } }, orderBy: { relevanceWeight: "desc" } },
  subprofileProjects: {
    where: { isVisible: true },
    select: { projectId: true, customTitle: true, customSummary: true, relevanceWeight: true, project: { select: projectSelect } },
    orderBy: { relevanceWeight: "desc" },
  },
  subprofileExperiences: { where: { isVisible: true }, select: { experienceId: true, relevanceWeight: true, experience: { select: experienceSelect } }, orderBy: { relevanceWeight: "desc" } },
  subprofileCourses: { where: { isVisible: true }, select: { courseId: true, relevanceWeight: true, course: { select: courseSelect } }, orderBy: { relevanceWeight: "desc" } },
  subprofileCertifications: { where: { isVisible: true }, select: { certificationId: true, relevanceWeight: true, certification: { select: certificationSelect } }, orderBy: { relevanceWeight: "desc" } },
  subprofileEducations: { where: { isVisible: true }, select: { educationId: true, education: { select: educationSelect } } },
  subprofileLanguages: { where: { isVisible: true }, select: { languageId: true, language: { select: languageSelect } } },
};

function serializeProfile(profile) {
  const linkedSkills = (profile.subprofileSkills || []).map((item) => ({ ...item.skill, relevanceWeight: item.relevanceWeight }));
  const skills = dedupeById([...(profile.skills || []), ...linkedSkills]);
  const linkedProjects = (profile.subprofileProjects || []).map((item) => ({
    ...item.project,
    customTitle: item.customTitle,
    customSummary: item.customSummary,
    relevanceWeight: item.relevanceWeight,
  }));
  const projects = dedupeById([...(profile.projects || []), ...linkedProjects]);
  const experiences = dedupeById([...(profile.experiences || []), ...(profile.subprofileExperiences || []).map((item) => ({ ...item.experience, relevanceWeight: item.relevanceWeight }))]);
  const courses = dedupeById([...(profile.courses || []), ...(profile.subprofileCourses || []).map((item) => ({ ...item.course, relevanceWeight: item.relevanceWeight }))]);
  const certifications = dedupeById([...(profile.certifications || []), ...(profile.subprofileCertifications || []).map((item) => ({ ...item.certification, relevanceWeight: item.relevanceWeight }))]);
  const educations = dedupeById([...(profile.educations || []), ...(profile.subprofileEducations || []).map((item) => item.education)]);
  const languages = dedupeById([...(profile.languages || []), ...(profile.subprofileLanguages || []).map((item) => item.language)]);
  const serialized = {
    id: profile.id,
    profileName: profile.profileName,
    isGlobal: !!profile.isGlobal,
    userId: profile.userId,
    name: profile.name,
    title: profile.title || "",
    emailContact: profile.emailContact || "",
    phone: profile.phone || "",
    location: profile.location || "",
    cep: profile.cep || "",
    linkedin: profile.linkedin || "",
    github: profile.github || "",
    lattes: profile.lattes || "",
    summary: profile.summary || "",
    objective: profile.objective || "",
    category: profile.category || "unknown",
    skillItems: skills.map((skill) => ({ id: skill.id, name: skill.name, normalizedName: skill.normalizedName || normalizeTerm(skill.name), category: skill.category || "other", relevanceWeight: skill.relevanceWeight || 50 })),
    skills: skills.map((skill) => skill.name),
    projects: projects.map((project) => ({
      id: project.id,
      title: project.customTitle || project.title,
      category: project.category || "other",
      shortDescription: project.customSummary || project.shortDescription || "",
      stack: project.stack || "",
      learnedSkills: project.learnedSkills || [],
      relevanceWeight: project.relevanceWeight || 50,
      repositoryUrl: project.repositoryUrl || "",
      deployUrl: project.deployUrl || "",
    })),
    experiences: experiences.map((experience) => ({
      id: experience.id,
      company: experience.company,
      role: experience.role,
      period: experience.period,
      workload: experience.workload || "",
      description: experience.description,
    })),
    courses: courses.map((course) => ({
      id: course.id,
      title: course.title,
      institution: course.institution || "",
      period: course.period || "",
      workload: course.workload || "",
      description: course.description || "",
      learnedSkills: course.learnedSkills || [],
    })),
    certifications: certifications.map((certification) => ({
      id: certification.id,
      title: certification.title,
      issuer: certification.issuer || "",
      period: certification.period || "",
      workload: certification.workload || "",
      credentialUrl: certification.credentialUrl || "",
      learnedSkills: certification.learnedSkills || [],
    })),
    languages: languages.map((language) => ({
      id: language.id,
      name: language.name,
      level: language.level || "",
    })),
    educations: educations.map((education) => ({
      id: education.id,
      title: education.title,
      institution: education.institution,
      period: education.period || "",
      learnedSkills: education.learnedSkills || [],
    })),
  };
  serialized.completion = profileCompletionChecklist(serialized);
  return serialized;
}

function profileCompletionChecklist(profile) {
  const checks = [
    ["nome", Boolean(String(profile.name || "").trim()), "informe o nome"],
    ["objetivo profissional", Boolean(String(profile.objective || "").trim()), "informe o objetivo profissional"],
    ["resumo profissional", Boolean(String(profile.summary || "").trim()), "informe o resumo profissional"],
    ["formacao", (profile.educations || []).length > 0, "adicione pelo menos 1 formacao"],
    ["idiomas", (profile.languages || []).length > 0, "adicione pelo menos 1 idioma"],
    ["habilidades tecnicas", (profile.skillItems || []).length > 0, "adicione habilidades tecnicas"],
    ["competencias", (profile.skillItems || []).some((skill) => ["other", "learned"].includes(skill.category || "other")), "adicione competencias relevantes"],
    ["projetos", (profile.projects || []).length > 0, "adicione pelo menos 1 projeto"],
    ["cursos ou certificacoes", (profile.courses || []).length + (profile.certifications || []).length > 0, "adicione pelo menos 1 curso ou certificacao"],
    ["habilidades aprendidas", hasCompleteLearnedSkills(profile), "preencha habilidades aprendidas em formacao, projetos, cursos e certificacoes"],
  ];
  const pending = checks.filter(([, ok]) => !ok).map(([, , message]) => message);
  return {
    percent: Math.round(((checks.length - pending.length) / checks.length) * 100),
    pending,
  };
}

function hasCompleteLearnedSkills(profile) {
  const collections = [
    ...(profile.educations || []),
    ...(profile.projects || []),
    ...(profile.courses || []),
    ...(profile.certifications || []),
  ];
  return collections.length > 0 && collections.every((item) => (item.learnedSkills || []).length > 0);
}

function normalizeLearnedSkillsInput(value) {
  return [...new Map(
    (Array.isArray(value) ? value : String(value || "").split(","))
      .flatMap((item) => String(item || "").split(","))
      .map((skill) => skill.trim())
      .filter(Boolean)
      .map((skill) => [normalizeTerm(skill), skill])
  ).values()];
}

function assertLearnedSkills(data) {
  const learnedSkills = normalizeLearnedSkillsInput(data.learnedSkills);
  if (learnedSkills.length) return learnedSkills;
  const err = new Error("Preencha as habilidades aprendidas antes de salvar este item.");
  err.statusCode = 400;
  err.code = "LEARNED_SKILLS_REQUIRED";
  throw err;
}

function buildGlobalCatalog(global, subprofile) {
  const selected = {
    skills: new Set((subprofile.subprofileSkills || []).map((item) => item.skillId)),
    projects: new Set((subprofile.subprofileProjects || []).map((item) => item.projectId)),
    experiences: new Set((subprofile.subprofileExperiences || []).map((item) => item.experienceId)),
    courses: new Set((subprofile.subprofileCourses || []).map((item) => item.courseId)),
    certifications: new Set((subprofile.subprofileCertifications || []).map((item) => item.certificationId)),
    educations: new Set((subprofile.subprofileEducations || []).map((item) => item.educationId)),
    languages: new Set((subprofile.subprofileLanguages || []).map((item) => item.languageId)),
  };
  const withSelection = (items, type) => (items || []).map((item) => ({ ...item, selected: selected[type].has(item.id) }));
  return {
    baseProfile: {
      name: global.name,
      title: global.title,
      emailContact: global.emailContact,
      phone: global.phone,
      location: global.location,
      cep: global.cep,
      linkedin: global.linkedin,
      github: global.github,
      lattes: global.lattes,
      summary: global.summary,
      objective: global.objective,
    },
    skills: withSelection(global.skills, "skills"),
    projects: withSelection(global.projects, "projects"),
    experiences: withSelection(global.experiences, "experiences"),
    courses: withSelection(global.courses, "courses"),
    certifications: withSelection(global.certifications, "certifications"),
    educations: withSelection(global.educations, "educations"),
    languages: withSelection(global.languages, "languages"),
  };
}

function dedupeById(items) {
  const map = new Map();
  items.filter(Boolean).forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

async function ensureDefaultProfile(userId, db = prisma) {
  const existing = await db.careerProfile.findFirst({
    where: { userId, isGlobal: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const fallback = await db.careerProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (fallback) {
    return db.careerProfile.update({
      where: { id: fallback.id },
      data: { isGlobal: true, profileName: "Perfil Global" },
    });
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  return db.careerProfile.create({
    data: {
      userId,
      profileName: "Perfil Global",
      isGlobal: true,
      name: user.name,
      title: user.title || "",
      emailContact: user.emailContact || user.email || "",
      phone: user.phone || "",
      location: user.location || "",
      cep: user.cep || "",
      linkedin: user.linkedin || "",
      github: user.github || "",
      lattes: user.lattes || "",
      summary: user.summary || "",
      objective: "",
    },
  });
}

async function resolveProfile(userId, profileId = null) {
  if (profileId) {
    const profile = await prisma.careerProfile.findFirst({
      where: { id: profileId, userId },
    });
    if (!profile) {
      const err = new Error("Perfil profissional não encontrado");
      err.statusCode = 404;
      throw err;
    }
    return profile;
  }

  return ensureDefaultProfile(userId);
}

async function listProfiles(userId) {
  return cache.remember("profiles", userId, "list", async () => {
    await ensureDefaultProfile(userId);
    return prisma.careerProfile.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, profileName: true, isGlobal: true, title: true, updatedAt: true },
    });
  });
}

async function invalidateProfileCache(userId) {
  await Promise.all([
    cache.invalidate("profiles", userId),
    cache.invalidate("profile", userId),
    cache.invalidate("profile-catalog", userId),
    cache.invalidate("shared-jobs-board", "global"),
  ]);
}

async function refreshedProfile(userId, profileId) {
  await invalidateProfileCache(userId);
  return getProfile(userId, profileId);
}

async function createProfile(userId, { profileName }) {
  const duplicate = await prisma.careerProfile.findFirst({
    where: {
      userId,
      profileName: { equals: profileName, mode: "insensitive" },
    },
    select: { id: true },
  });
  if (duplicate) {
    const err = new Error("Ja existe um perfil com este nome");
    err.statusCode = 409;
    throw err;
  }

  const profile = await prisma.$transaction(async (tx) => {
    await subscriptionService.assertSubprofileLimit(userId, tx);
    await ensureDefaultProfile(userId, tx);
    const user = await tx.user.findUnique({ where: { id: userId } });
    const created = await tx.careerProfile.create({
      data: {
        userId,
        profileName,
        name: user.name,
        title: "",
        emailContact: user.emailContact || user.email || "",
        phone: user.phone || "",
        location: user.location || "",
        cep: user.cep || "",
        linkedin: user.linkedin || "",
        github: user.github || "",
        lattes: user.lattes || "",
        summary: "",
        objective: "",
        category: normalizeTerm(profileName),
      },
      include: profileInclude,
    });
    return created;
  });
  return refreshedProfile(userId, profile.id);
}

async function deleteProfile(userId, profileId) {
  const profile = await prisma.careerProfile.findFirst({
    where: { id: profileId, userId },
    select: { id: true, isGlobal: true },
  });
  if (!profile) {
    const err = new Error("Subperfil nao encontrado");
    err.statusCode = 404;
    throw err;
  }
  if (profile.isGlobal) {
    const err = new Error("O Perfil Global nao pode ser excluido");
    err.statusCode = 400;
    throw err;
  }

  await prisma.careerProfile.delete({ where: { id: profile.id } });
  await Promise.all([
    invalidateProfileCache(userId),
    cache.invalidate("resume-files", userId),
    cache.invalidate("match-history", userId),
  ]);
  return { message: "Subperfil removido." };
}

async function inheritGlobalCollections(subprofileId, globalProfileId, db = prisma) {
  const global = await db.careerProfile.findUnique({
    where: { id: globalProfileId },
    include: { skills: true, projects: true, experiences: true, courses: true, certifications: true, educations: true, languages: true },
  });
  const createManyIfAny = (model, data) => data.length ? model.createMany({ data, skipDuplicates: true }) : Promise.resolve();
  await Promise.all([
    createManyIfAny(db.subprofileSkill, global.skills.map((item) => ({ subprofileId, skillId: item.id }))),
    createManyIfAny(db.subprofileProject, global.projects.map((item) => ({ subprofileId, projectId: item.id }))),
    createManyIfAny(db.subprofileExperience, global.experiences.map((item) => ({ subprofileId, experienceId: item.id }))),
    createManyIfAny(db.subprofileCourse, global.courses.map((item) => ({ subprofileId, courseId: item.id }))),
    createManyIfAny(db.subprofileCertification, global.certifications.map((item) => ({ subprofileId, certificationId: item.id }))),
    createManyIfAny(db.subprofileEducation, global.educations.map((item) => ({ subprofileId, educationId: item.id }))),
    createManyIfAny(db.subprofileLanguage, global.languages.map((item) => ({ subprofileId, languageId: item.id }))),
  ]);
}

async function loadProfile(userId, profileId = null) {
  const profile = profileId
    ? await prisma.careerProfile.findFirst({ where: { id: profileId, userId }, include: profileInclude })
    : await (async () => {
      const global = await ensureDefaultProfile(userId);
      return prisma.careerProfile.findFirst({ where: { id: global.id, userId }, include: profileInclude });
    })();
  if (!profile) {
    const err = new Error("Perfil profissional não encontrado");
    err.statusCode = 404;
    throw err;
  }
  const full = profile;
  if (!full.isGlobal) {
    const globalCatalog = await getGlobalCatalog(userId);
    const serialized = serializeProfile(full);
    serialized.globalCatalog = buildGlobalCatalog(globalCatalog, full);
    return serialized;
  }
  return serializeProfile(full);
}

async function getGlobalCatalog(userId) {
  return cache.remember("profile-catalog", userId, "global", async () => {
    let globalCatalog = await prisma.careerProfile.findFirst({
      where: { userId, isGlobal: true },
      orderBy: { createdAt: "asc" },
      include: globalCatalogInclude,
    });
    if (!globalCatalog) {
      const global = await ensureDefaultProfile(userId);
      globalCatalog = await prisma.careerProfile.findFirst({
        where: { id: global.id, userId },
        include: globalCatalogInclude,
      });
    }
    return globalCatalog;
  });
}

async function getProfile(userId, profileId = null) {
  return cache.remember("profile", userId, profileId || "global", () => loadProfile(userId, profileId));
}

async function updateSubprofileAllocation(userId, data) {
  const profile = await resolveProfile(userId, data.profileId);
  if (profile.isGlobal) {
    const err = new Error("Selecione um subperfil para configurar alocacoes");
    err.statusCode = 400;
    throw err;
  }
  const global = await ensureDefaultProfile(userId);
  const catalog = await prisma.careerProfile.findFirst({
    where: { id: global.id, userId },
    include: { skills: true, projects: true, experiences: true, courses: true, certifications: true, educations: true, languages: true },
  });
  const requested = {
    skillIds: ["skills", data.skillIds],
    projectIds: ["projects", data.projectIds],
    experienceIds: ["experiences", data.experienceIds],
    courseIds: ["courses", data.courseIds],
    certificationIds: ["certifications", data.certificationIds],
    educationIds: ["educations", data.educationIds],
    languageIds: ["languages", data.languageIds],
  };
  Object.entries(requested).forEach(([field, [collection, ids]]) => {
    const validIds = new Set((catalog[collection] || []).map((item) => item.id));
    if (ids.some((id) => !validIds.has(id))) {
      const err = new Error(`Item global invalido em ${field}`);
      err.statusCode = 400;
      throw err;
    }
  });
  const operations = [
    prisma.subprofileSkill.deleteMany({ where: { subprofileId: profile.id } }),
    prisma.subprofileProject.deleteMany({ where: { subprofileId: profile.id } }),
    prisma.subprofileExperience.deleteMany({ where: { subprofileId: profile.id } }),
    prisma.subprofileCourse.deleteMany({ where: { subprofileId: profile.id } }),
    prisma.subprofileCertification.deleteMany({ where: { subprofileId: profile.id } }),
    prisma.subprofileEducation.deleteMany({ where: { subprofileId: profile.id } }),
    prisma.subprofileLanguage.deleteMany({ where: { subprofileId: profile.id } }),
  ];
  if (data.skillIds.length) operations.push(prisma.subprofileSkill.createMany({ data: data.skillIds.map((skillId) => ({ subprofileId: profile.id, skillId })) }));
  if (data.projectIds.length) operations.push(prisma.subprofileProject.createMany({ data: data.projectIds.map((projectId) => ({ subprofileId: profile.id, projectId })) }));
  if (data.experienceIds.length) operations.push(prisma.subprofileExperience.createMany({ data: data.experienceIds.map((experienceId) => ({ subprofileId: profile.id, experienceId })) }));
  if (data.courseIds.length) operations.push(prisma.subprofileCourse.createMany({ data: data.courseIds.map((courseId) => ({ subprofileId: profile.id, courseId })) }));
  if (data.certificationIds.length) operations.push(prisma.subprofileCertification.createMany({ data: data.certificationIds.map((certificationId) => ({ subprofileId: profile.id, certificationId })) }));
  if (data.educationIds.length) operations.push(prisma.subprofileEducation.createMany({ data: data.educationIds.map((educationId) => ({ subprofileId: profile.id, educationId })) }));
  if (data.languageIds.length) operations.push(prisma.subprofileLanguage.createMany({ data: data.languageIds.map((languageId) => ({ subprofileId: profile.id, languageId })) }));
  if (data.copyBaseProfile) {
    operations.push(prisma.careerProfile.update({
      where: { id: profile.id },
      data: {
        name: catalog.name,
        title: catalog.title,
        emailContact: catalog.emailContact,
        phone: catalog.phone,
        location: catalog.location,
        cep: catalog.cep,
        linkedin: catalog.linkedin,
        github: catalog.github,
        lattes: catalog.lattes,
        objective: catalog.objective,
      },
    }));
  }
  await prisma.$transaction(operations);
  return refreshedProfile(userId, profile.id);
}

async function updateProfile(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  if (data.profileName && data.profileName !== profile.profileName) {
    const duplicate = await prisma.careerProfile.findFirst({
      where: {
        userId,
        id: { not: profile.id },
        profileName: { equals: data.profileName, mode: "insensitive" },
      },
      select: { id: true },
    });
    if (duplicate) {
      const err = new Error("Ja existe um perfil com este nome");
      err.statusCode = 409;
      throw err;
    }
  }
  const updated = await prisma.careerProfile.update({
    where: { id: profile.id },
    data,
    include: profileInclude,
  });
  await invalidateProfileCache(userId);
  return serializeProfile(updated);
}

async function updateSkills(userId, profileId, skills) {
  const profile = await resolveProfile(userId, profileId);
  const uniqueSkills = [...new Map(
    skills
      .flatMap((skill) => String(skill).split(","))
      .map((skill) => skill.trim())
      .filter(Boolean)
      .map((skill) => [normalizeTerm(skill), skill])
  ).values()];

  if (!profile.isGlobal) {
    const global = await ensureDefaultProfile(userId);
    const existing = await prisma.skill.findMany({ where: { profileId: global.id } });
    const byName = new Map(existing.map((skill) => [normalizeTerm(skill.name), skill]));
    for (const name of uniqueSkills) {
      if (!byName.has(normalizeTerm(name))) {
        const created = await prisma.skill.create({
          data: { name, normalizedName: normalizeTerm(name), userId, profileId: global.id },
        });
        byName.set(normalizeTerm(name), created);
      }
    }
    await prisma.$transaction([
      prisma.subprofileSkill.deleteMany({ where: { subprofileId: profile.id } }),
      prisma.subprofileSkill.createMany({
        data: uniqueSkills.map((name) => ({ subprofileId: profile.id, skillId: byName.get(normalizeTerm(name)).id })),
        skipDuplicates: true,
      }),
    ]);
    return refreshedProfile(userId, profile.id);
  }

  await prisma.$transaction([
    prisma.skill.deleteMany({ where: { profileId: profile.id } }),
    prisma.skill.createMany({
      data: uniqueSkills.map((name) => ({ name, normalizedName: normalizeTerm(name), userId, profileId: profile.id })),
      skipDuplicates: true,
    }),
  ]);

  return refreshedProfile(userId, profile.id);
}

async function addProject(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);

  const ownerProfile = profile.isGlobal ? profile : await ensureDefaultProfile(userId);
  const project = await prisma.project.create({
    data: {
      title: data.title,
      description: data.shortDescription,
      shortDescription: data.shortDescription,
      category: data.category || "other",
      stack: "",
      learnedSkills: data.learnedSkills || [],
      businessProblem: "",
      technicalSolution: "",
      architecture: "",
      repositoryUrl: data.repositoryUrl || "",
      deployUrl: data.deployUrl || "",
      userId,
      profileId: ownerProfile.id,
    },
  });
  if (!profile.isGlobal) {
    await prisma.subprofileProject.create({ data: { subprofileId: profile.id, projectId: project.id } });
  }

  return refreshedProfile(userId, profile.id);
}

async function updateProject(userId, profileId, id, data) {
  const profile = await resolveProfile(userId, profileId);
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) {
    const err = new Error("Projeto nao encontrado");
    err.statusCode = 404;
    throw err;
  }
  await prisma.project.update({
    where: { id: project.id },
    data: {
      title: data.title,
      description: data.shortDescription,
      shortDescription: data.shortDescription,
      category: data.category || "other",
      stack: "",
      learnedSkills: data.learnedSkills || [],
      businessProblem: "",
      technicalSolution: "",
      architecture: "",
      repositoryUrl: data.repositoryUrl || "",
      deployUrl: data.deployUrl || "",
      technologies: {
        deleteMany: {},
      },
      bullets: {
        deleteMany: {},
      },
    },
  });
  return refreshedProfile(userId, profile.id);
}

async function deleteProject(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileProject.updateMany({ where: { projectId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return refreshedProfile(userId, profile.id);
  }
  const result = await prisma.project.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Projeto não encontrado");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function addExperience(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  await prisma.experience.create({ data: { ...data, userId, profileId: profile.id } });
  return refreshedProfile(userId, profile.id);
}

async function updateExperience(userId, profileId, id, data) {
  const profile = await resolveProfile(userId, profileId);
  const { profileId: ignoredProfileId, ...updates } = data;
  const result = await prisma.experience.updateMany({ where: { id, userId }, data: updates });
  if (!result.count) {
    const err = new Error("Experiencia nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function deleteExperience(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileExperience.updateMany({ where: { experienceId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return refreshedProfile(userId, profile.id);
  }
  const result = await prisma.experience.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Experiência não encontrada");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function addCourse(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  const owner = profile.isGlobal ? profile : await ensureDefaultProfile(userId);
  const course = await prisma.course.create({ data: { ...data, userId, profileId: owner.id } });
  if (!profile.isGlobal) {
    await prisma.subprofileCourse.create({ data: { subprofileId: profile.id, courseId: course.id } });
  }
  return refreshedProfile(userId, profile.id);
}

async function updateCourse(userId, profileId, id, data) {
  const profile = await resolveProfile(userId, profileId);
  const { profileId: ignoredProfileId, ...updates } = data;
  const result = await prisma.course.updateMany({ where: { id, userId }, data: updates });
  if (!result.count) {
    const err = new Error("Curso nao encontrado");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function deleteCourse(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileCourse.updateMany({ where: { courseId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return refreshedProfile(userId, profile.id);
  }
  const result = await prisma.course.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Curso não encontrado");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function addCertification(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  const owner = profile.isGlobal ? profile : await ensureDefaultProfile(userId);
  const certification = await prisma.certification.create({ data: { ...data, userId, profileId: owner.id } });
  if (!profile.isGlobal) {
    await prisma.subprofileCertification.create({ data: { subprofileId: profile.id, certificationId: certification.id } });
  }
  return refreshedProfile(userId, profile.id);
}

async function updateCertification(userId, profileId, id, data) {
  const profile = await resolveProfile(userId, profileId);
  const { profileId: ignoredProfileId, ...updates } = data;
  const result = await prisma.certification.updateMany({ where: { id, userId }, data: updates });
  if (!result.count) {
    const err = new Error("Certificacao nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function deleteCertification(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileCertification.updateMany({ where: { certificationId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return refreshedProfile(userId, profile.id);
  }
  const result = await prisma.certification.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Certificação não encontrada");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function addLanguage(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  const owner = profile.isGlobal ? profile : await ensureDefaultProfile(userId);
  const language = await prisma.language.create({ data: { ...data, userId, profileId: owner.id } });
  if (!profile.isGlobal) {
    await prisma.subprofileLanguage.create({ data: { subprofileId: profile.id, languageId: language.id } });
  }
  return refreshedProfile(userId, profile.id);
}

async function updateLanguage(userId, profileId, id, data) {
  const profile = await resolveProfile(userId, profileId);
  const { profileId: ignoredProfileId, ...updates } = data;
  const result = await prisma.language.updateMany({ where: { id, userId }, data: updates });
  if (!result.count) {
    const err = new Error("Idioma nao encontrado");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function addEducation(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  const owner = profile.isGlobal ? profile : await ensureDefaultProfile(userId);
  const education = await prisma.education.create({ data: { ...data, userId, profileId: owner.id } });
  if (!profile.isGlobal) {
    await prisma.subprofileEducation.create({ data: { subprofileId: profile.id, educationId: education.id } });
  }
  return refreshedProfile(userId, profile.id);
}

async function updateEducation(userId, profileId, id, data) {
  const profile = await resolveProfile(userId, profileId);
  const { profileId: ignoredProfileId, ...updates } = data;
  const result = await prisma.education.updateMany({ where: { id, userId }, data: updates });
  if (!result.count) {
    const err = new Error("Formacao nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function deleteEducation(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileEducation.updateMany({ where: { educationId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return refreshedProfile(userId, profile.id);
  }
  const result = await prisma.education.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (!result.count) {
    const err = new Error("Formacao nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

async function deleteLanguage(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileLanguage.updateMany({ where: { languageId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return refreshedProfile(userId, profile.id);
  }
  const result = await prisma.language.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Idioma nÃ£o encontrado");
    err.statusCode = 404;
    throw err;
  }
  return refreshedProfile(userId, profile.id);
}

module.exports = {
  listProfiles,
  createProfile,
  deleteProfile,
  getProfile,
  updateProfile,
  updateSubprofileAllocation,
  updateSkills,
  addProject,
  updateProject,
  deleteProject,
  addExperience,
  updateExperience,
  deleteExperience,
  addCourse,
  updateCourse,
  deleteCourse,
  addCertification,
  updateCertification,
  deleteCertification,
  addLanguage,
  updateLanguage,
  deleteLanguage,
  addEducation,
  updateEducation,
  deleteEducation,
  resolveProfile,
  serializeProfile,
  profileInclude,
  profileCompletionChecklist,
};
