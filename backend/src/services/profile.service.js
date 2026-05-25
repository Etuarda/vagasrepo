const { prisma } = require("../lib/prisma");
const { normalizeTerm } = require("../modules/matching/keyword-normalizer");

const profileInclude = {
  skills: { orderBy: { name: "asc" } },
  projects: {
    orderBy: { createdAt: "desc" },
  },
  experiences: { orderBy: { createdAt: "desc" } },
  courses: { orderBy: { createdAt: "desc" } },
  certifications: { orderBy: { createdAt: "desc" } },
  languages: { orderBy: { createdAt: "desc" } },
  educations: { orderBy: { createdAt: "desc" } },
  subprofileSkills: { where: { isVisible: true }, include: { skill: true }, orderBy: { relevanceWeight: "desc" } },
  subprofileProjects: {
    where: { isVisible: true },
    include: { project: true },
    orderBy: { relevanceWeight: "desc" },
  },
  subprofileExperiences: { where: { isVisible: true }, include: { experience: true }, orderBy: { relevanceWeight: "desc" } },
  subprofileCourses: { where: { isVisible: true }, include: { course: true }, orderBy: { relevanceWeight: "desc" } },
  subprofileCertifications: { where: { isVisible: true }, include: { certification: true }, orderBy: { relevanceWeight: "desc" } },
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
  return {
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
    })),
    certifications: certifications.map((certification) => ({
      id: certification.id,
      title: certification.title,
      issuer: certification.issuer || "",
      period: certification.period || "",
      workload: certification.workload || "",
      credentialUrl: certification.credentialUrl || "",
    })),
    languages: (profile.languages || []).map((language) => ({
      id: language.id,
      name: language.name,
      level: language.level || "",
    })),
    educations: (profile.educations || []).map((education) => ({
      id: education.id,
      title: education.title,
      institution: education.institution,
      period: education.period || "",
    })),
  };
}

function dedupeById(items) {
  const map = new Map();
  items.filter(Boolean).forEach((item) => map.set(item.id, item));
  return [...map.values()];
}

async function ensureDefaultProfile(userId) {
  const existing = await prisma.careerProfile.findFirst({
    where: { userId, isGlobal: true },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const fallback = await prisma.careerProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (fallback) {
    return prisma.careerProfile.update({
      where: { id: fallback.id },
      data: { isGlobal: true, profileName: "Perfil Global" },
    });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return prisma.careerProfile.create({
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
  await ensureDefaultProfile(userId);
  return prisma.careerProfile.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, profileName: true, isGlobal: true, title: true, updatedAt: true },
  });
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

  const base = await ensureDefaultProfile(userId);
  const profile = await prisma.careerProfile.create({
    data: {
      userId,
      profileName,
      name: base.name,
      title: base.title,
      emailContact: base.emailContact,
      phone: base.phone,
      location: base.location,
      cep: base.cep,
      linkedin: base.linkedin,
      github: base.github,
      lattes: base.lattes,
      summary: base.summary,
      category: normalizeTerm(profileName),
    },
    include: profileInclude,
  });

  await inheritGlobalCollections(profile.id, base.id);
  return getProfile(userId, profile.id);
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
  return { message: "Subperfil removido." };
}

async function inheritGlobalCollections(subprofileId, globalProfileId) {
  const global = await prisma.careerProfile.findUnique({
    where: { id: globalProfileId },
    include: { skills: true, projects: true, experiences: true, courses: true, certifications: true },
  });
  await prisma.$transaction([
    prisma.subprofileSkill.createMany({ data: global.skills.map((item) => ({ subprofileId, skillId: item.id })), skipDuplicates: true }),
    prisma.subprofileProject.createMany({ data: global.projects.map((item) => ({ subprofileId, projectId: item.id })), skipDuplicates: true }),
    prisma.subprofileExperience.createMany({ data: global.experiences.map((item) => ({ subprofileId, experienceId: item.id })), skipDuplicates: true }),
    prisma.subprofileCourse.createMany({ data: global.courses.map((item) => ({ subprofileId, courseId: item.id })), skipDuplicates: true }),
    prisma.subprofileCertification.createMany({ data: global.certifications.map((item) => ({ subprofileId, certificationId: item.id })), skipDuplicates: true }),
  ]);
}

async function getProfile(userId, profileId = null) {
  const profile = await resolveProfile(userId, profileId);
  const full = await prisma.careerProfile.findFirst({
    where: { id: profile.id, userId },
    include: profileInclude,
  });
  if (!full.isGlobal) {
    const global = await ensureDefaultProfile(userId);
    const globalShared = await prisma.careerProfile.findFirst({
      where: { id: global.id, userId },
      include: { languages: true, educations: true },
    });
    full.languages = dedupeById([...(full.languages || []), ...(globalShared.languages || [])]);
    full.educations = dedupeById([...(full.educations || []), ...(globalShared.educations || [])]);
  }
  return serializeProfile(full);
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
    return getProfile(userId, profile.id);
  }

  await prisma.$transaction([
    prisma.skill.deleteMany({ where: { profileId: profile.id } }),
    prisma.skill.createMany({
      data: uniqueSkills.map((name) => ({ name, normalizedName: normalizeTerm(name), userId, profileId: profile.id })),
      skipDuplicates: true,
    }),
  ]);

  return getProfile(userId, profile.id);
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

  return getProfile(userId, profile.id);
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
  return getProfile(userId, profile.id);
}

async function deleteProject(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileProject.updateMany({ where: { projectId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return getProfile(userId, profile.id);
  }
  const result = await prisma.project.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Projeto não encontrado");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId, profile.id);
}

async function addExperience(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  await prisma.experience.create({ data: { ...data, userId, profileId: profile.id } });
  return getProfile(userId, profile.id);
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
  return getProfile(userId, profile.id);
}

async function deleteExperience(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileExperience.updateMany({ where: { experienceId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return getProfile(userId, profile.id);
  }
  const result = await prisma.experience.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Experiência não encontrada");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId, profile.id);
}

async function addCourse(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  await prisma.course.create({ data: { ...data, userId, profileId: profile.id } });
  return getProfile(userId, profile.id);
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
  return getProfile(userId, profile.id);
}

async function deleteCourse(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileCourse.updateMany({ where: { courseId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return getProfile(userId, profile.id);
  }
  const result = await prisma.course.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Curso não encontrado");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId, profile.id);
}

async function addCertification(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  await prisma.certification.create({ data: { ...data, userId, profileId: profile.id } });
  return getProfile(userId, profile.id);
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
  return getProfile(userId, profile.id);
}

async function deleteCertification(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const hidden = await prisma.subprofileCertification.updateMany({ where: { certificationId: id, subprofileId: profile.id }, data: { isVisible: false } });
    if (hidden.count) return getProfile(userId, profile.id);
  }
  const result = await prisma.certification.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Certificação não encontrada");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId, profile.id);
}

async function addLanguage(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  await prisma.language.create({ data: { ...data, userId, profileId: profile.id } });
  return getProfile(userId, profile.id);
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
  return getProfile(userId, profile.id);
}

async function addEducation(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  const owner = profile.isGlobal ? profile : await ensureDefaultProfile(userId);
  await prisma.education.create({ data: { ...data, userId, profileId: owner.id } });
  return getProfile(userId, profile.id);
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
  return getProfile(userId, profile.id);
}

async function deleteEducation(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  if (!profile.isGlobal) {
    const err = new Error("Remova formacao somente no Perfil Global");
    err.statusCode = 400;
    throw err;
  }
  const result = await prisma.education.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (!result.count) {
    const err = new Error("Formacao nao encontrada");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId, profile.id);
}

async function deleteLanguage(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  const result = await prisma.language.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Idioma nÃ£o encontrado");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId, profile.id);
}

module.exports = {
  listProfiles,
  createProfile,
  deleteProfile,
  getProfile,
  updateProfile,
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
};
