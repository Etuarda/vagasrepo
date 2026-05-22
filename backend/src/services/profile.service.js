const { prisma } = require("../lib/prisma");

const profileInclude = {
  skills: { orderBy: { name: "asc" } },
  projects: {
    orderBy: { createdAt: "desc" },
    include: { technologies: { orderBy: { name: "asc" } } },
  },
  experiences: { orderBy: { createdAt: "desc" } },
};

function serializeProfile(profile) {
  return {
    id: profile.id,
    profileName: profile.profileName,
    userId: profile.userId,
    name: profile.name,
    title: profile.title || "",
    emailContact: profile.emailContact || "",
    phone: profile.phone || "",
    location: profile.location || "",
    linkedin: profile.linkedin || "",
    github: profile.github || "",
    summary: profile.summary || "",
    skills: (profile.skills || []).map((skill) => skill.name),
    projects: (profile.projects || []).map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      technologies: (project.technologies || []).map((tech) => tech.name),
    })),
    experiences: (profile.experiences || []).map((experience) => ({
      id: experience.id,
      company: experience.company,
      role: experience.role,
      period: experience.period,
      description: experience.description,
    })),
  };
}

async function ensureDefaultProfile(userId) {
  const existing = await prisma.careerProfile.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  return prisma.careerProfile.create({
    data: {
      userId,
      profileName: "Perfil principal",
      name: user.name,
      title: user.title || "",
      emailContact: user.emailContact || user.email || "",
      phone: user.phone || "",
      location: user.location || "",
      linkedin: user.linkedin || "",
      github: user.github || "",
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
    select: { id: true, profileName: true, title: true, updatedAt: true },
  });
}

async function createProfile(userId, { profileName }) {
  const base = await ensureDefaultProfile(userId);
  const profile = await prisma.careerProfile.create({
    data: {
      userId,
      profileName,
      name: base.name,
      emailContact: base.emailContact,
    },
    include: profileInclude,
  });
  return serializeProfile(profile);
}

async function getProfile(userId, profileId = null) {
  const profile = await resolveProfile(userId, profileId);
  const full = await prisma.careerProfile.findFirst({
    where: { id: profile.id, userId },
    include: profileInclude,
  });
  return serializeProfile(full);
}

async function updateProfile(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  const updated = await prisma.careerProfile.update({
    where: { id: profile.id },
    data,
    include: profileInclude,
  });
  return serializeProfile(updated);
}

async function updateProfileFromPdf(userId, profileId, extracted) {
  const profile = await resolveProfile(userId, profileId);
  const data = {};

  ["name", "title", "emailContact", "phone", "location", "linkedin", "github", "summary"].forEach((key) => {
    if (extracted[key]) data[key] = extracted[key];
  });

  if (Object.keys(data).length) {
    await prisma.careerProfile.update({ where: { id: profile.id }, data });
  }

  if (extracted.skills?.length) {
    const current = await prisma.skill.findMany({ where: { profileId: profile.id }, select: { name: true } });
    const skills = [...new Set([...current.map((s) => s.name), ...extracted.skills])];
    await updateSkills(userId, profile.id, skills);
  }

  return getProfile(userId, profile.id);
}

async function updateSkills(userId, profileId, skills) {
  const profile = await resolveProfile(userId, profileId);
  const uniqueSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];

  await prisma.$transaction([
    prisma.skill.deleteMany({ where: { profileId: profile.id } }),
    prisma.skill.createMany({
      data: uniqueSkills.map((name) => ({ name, userId, profileId: profile.id })),
      skipDuplicates: true,
    }),
  ]);

  return getProfile(userId, profile.id);
}

async function addProject(userId, profileId, data) {
  const profile = await resolveProfile(userId, profileId);
  const technologies = [...new Set(data.technologies.map((tech) => tech.trim()).filter(Boolean))];

  await prisma.project.create({
    data: {
      title: data.title,
      description: data.description,
      userId,
      profileId: profile.id,
      technologies: {
        create: technologies.map((name) => ({ name })),
      },
    },
  });

  return getProfile(userId, profile.id);
}

async function deleteProject(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
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

async function deleteExperience(userId, profileId, id) {
  const profile = await resolveProfile(userId, profileId);
  const result = await prisma.experience.deleteMany({ where: { id, userId, profileId: profile.id } });
  if (result.count === 0) {
    const err = new Error("Experiência não encontrada");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId, profile.id);
}

module.exports = {
  listProfiles,
  createProfile,
  getProfile,
  updateProfile,
  updateProfileFromPdf,
  updateSkills,
  addProject,
  deleteProject,
  addExperience,
  deleteExperience,
  resolveProfile,
  serializeProfile,
  profileInclude,
};
