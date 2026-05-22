const { prisma } = require("../lib/prisma");

const profileInclude = {
  skills: { orderBy: { name: "asc" } },
  projects: {
    orderBy: { createdAt: "desc" },
    include: { technologies: { orderBy: { name: "asc" } } },
  },
  experiences: { orderBy: { createdAt: "desc" } },
};

function serializeProfile(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    title: user.title || "",
    emailContact: user.emailContact || "",
    phone: user.phone || "",
    location: user.location || "",
    linkedin: user.linkedin || "",
    github: user.github || "",
    summary: user.summary || "",
    skills: (user.skills || []).map((skill) => skill.name),
    projects: (user.projects || []).map((project) => ({
      id: project.id,
      title: project.title,
      description: project.description,
      technologies: (project.technologies || []).map((tech) => tech.name),
    })),
    experiences: (user.experiences || []).map((experience) => ({
      id: experience.id,
      company: experience.company,
      role: experience.role,
      period: experience.period,
      description: experience.description,
    })),
  };
}

async function getProfile(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: profileInclude,
  });
  return serializeProfile(user);
}

async function updateProfile(userId, data) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    include: profileInclude,
  });
  return serializeProfile(user);
}

async function updateSkills(userId, skills) {
  const uniqueSkills = [...new Set(skills.map((skill) => skill.trim()).filter(Boolean))];

  await prisma.$transaction([
    prisma.skill.deleteMany({ where: { userId } }),
    prisma.skill.createMany({
      data: uniqueSkills.map((name) => ({ name, userId })),
      skipDuplicates: true,
    }),
  ]);

  return getProfile(userId);
}

async function addProject(userId, data) {
  const technologies = [...new Set(data.technologies.map((tech) => tech.trim()).filter(Boolean))];

  await prisma.project.create({
    data: {
      title: data.title,
      description: data.description,
      userId,
      technologies: {
        create: technologies.map((name) => ({ name })),
      },
    },
  });

  return getProfile(userId);
}

async function deleteProject(userId, id) {
  const result = await prisma.project.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    const err = new Error("Projeto não encontrado");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId);
}

async function addExperience(userId, data) {
  await prisma.experience.create({ data: { ...data, userId } });
  return getProfile(userId);
}

async function deleteExperience(userId, id) {
  const result = await prisma.experience.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    const err = new Error("Experiência não encontrada");
    err.statusCode = 404;
    throw err;
  }
  return getProfile(userId);
}

module.exports = {
  getProfile,
  updateProfile,
  updateSkills,
  addProject,
  deleteProject,
  addExperience,
  deleteExperience,
  serializeProfile,
  profileInclude,
};
