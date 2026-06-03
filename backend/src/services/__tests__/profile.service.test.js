jest.mock("../../lib/prisma", () => ({
  prisma: {
    $transaction: jest.fn(),
    careerProfile: {
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
    experience: {
      updateMany: jest.fn(),
    },
  },
}));
jest.mock("../../lib/cache", () => ({
  remember: jest.fn((namespace, owner, variant, loader) => loader()),
  invalidate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../subscription.service", () => ({
  assertSubprofileLimit: jest.fn().mockResolvedValue(undefined),
}));

const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const subscriptionService = require("../subscription.service");
const { createProfile, deleteProfile, updateExperience, getProfile, profileInclude } = require("../profile.service");

describe("subprofile deletion", () => {
  beforeEach(() => jest.clearAllMocks());

  it("impede criar subperfil com nome ja utilizado", async () => {
    prisma.careerProfile.findFirst.mockResolvedValue({ id: "existing" });

    await expect(createProfile("user", { profileName: "Backend" })).rejects.toMatchObject({
      statusCode: 409,
      message: "Ja existe um perfil com este nome",
    });
    expect(prisma.careerProfile.findFirst).toHaveBeenCalledWith({
      where: { userId: "user", profileName: { equals: "Backend", mode: "insensitive" } },
      select: { id: true },
    });
    expect(subscriptionService.assertSubprofileLimit).not.toHaveBeenCalled();
  });

  it("cria subperfil mesmo quando o Perfil Global tem colecoes vazias", async () => {
    const base = {
      id: "global",
      userId: "user",
      profileName: "Perfil Global",
      isGlobal: true,
      name: "Pessoa",
      title: "",
      emailContact: "",
      phone: "",
      location: "",
      cep: "",
      linkedin: "",
      github: "",
      lattes: "",
      summary: "",
      objective: "",
      category: "unknown",
      skills: [],
      projects: [],
      experiences: [],
      courses: [],
      certifications: [],
      educations: [],
      languages: [],
      subprofileSkills: [],
      subprofileProjects: [],
      subprofileExperiences: [],
      subprofileCourses: [],
      subprofileCertifications: [],
      subprofileEducations: [],
      subprofileLanguages: [],
    };
    const created = { ...base, id: "frontend", profileName: "Frontend", isGlobal: false };
    const tx = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: "user",
          name: "Pessoa",
          email: "pessoa@example.com",
          emailContact: "",
          phone: "",
          location: "",
          cep: "",
          linkedin: "",
          github: "",
          lattes: "",
        }),
      },
      careerProfile: {
        findFirst: jest.fn().mockResolvedValue(base),
        create: jest.fn().mockResolvedValue(created),
        findUnique: jest.fn().mockResolvedValue(base),
      },
      subprofileSkill: { createMany: jest.fn() },
      subprofileProject: { createMany: jest.fn() },
      subprofileExperience: { createMany: jest.fn() },
      subprofileCourse: { createMany: jest.fn() },
      subprofileCertification: { createMany: jest.fn() },
      subprofileEducation: { createMany: jest.fn() },
      subprofileLanguage: { createMany: jest.fn() },
    };
    prisma.careerProfile.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(created);
    prisma.$transaction.mockImplementation((work) => work(tx));

    await expect(createProfile("user", { profileName: "Frontend" })).resolves.toMatchObject({ id: "frontend" });

    expect(subscriptionService.assertSubprofileLimit).toHaveBeenCalledWith("user", tx);
    expect(tx.careerProfile.create).toHaveBeenCalled();
    expect(tx.careerProfile.create.mock.calls[0][0].data).toEqual(expect.objectContaining({
      summary: "",
      objective: "",
    }));
    expect(tx.subprofileSkill.createMany).not.toHaveBeenCalled();
    expect(cache.invalidate).toHaveBeenCalledWith("profiles", "user");
  });

  it("remove somente subperfil pertencente ao usuario", async () => {
    prisma.careerProfile.findFirst.mockResolvedValue({ id: "subprofile", isGlobal: false });
    prisma.careerProfile.delete.mockResolvedValue({ id: "subprofile" });

    await expect(deleteProfile("user", "subprofile")).resolves.toEqual({ message: "Subperfil removido." });
    expect(prisma.careerProfile.findFirst).toHaveBeenCalledWith({
      where: { id: "subprofile", userId: "user" },
      select: { id: true, isGlobal: true },
    });
    expect(prisma.careerProfile.delete).toHaveBeenCalledWith({ where: { id: "subprofile" } });
    expect(cache.invalidate).toHaveBeenCalledWith("profile", "user");
    expect(cache.invalidate).toHaveBeenCalledWith("profile-catalog", "user");
    expect(cache.invalidate).toHaveBeenCalledWith("resume-files", "user");
    expect(cache.invalidate).toHaveBeenCalledWith("match-history", "user");
  });

  it("impede exclusao do Perfil Global", async () => {
    prisma.careerProfile.findFirst.mockResolvedValue({ id: "global", isGlobal: true });

    await expect(deleteProfile("user", "global")).rejects.toMatchObject({
      statusCode: 400,
      message: "O Perfil Global nao pode ser excluido",
    });
    expect(prisma.careerProfile.delete).not.toHaveBeenCalled();
  });

  it("edita experiencia somente quando o item pertence ao usuario autenticado", async () => {
    prisma.careerProfile.findFirst.mockResolvedValue({ id: "profile" });
    prisma.experience.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateExperience("user", "profile", "experience", {
      profileId: "profile",
      company: "Empresa",
      role: "Backend",
      period: "2025",
      workload: "40h",
      description: "Atividades reais suficientemente detalhadas.",
    })).rejects.toMatchObject({ statusCode: 404 });

    expect(prisma.experience.updateMany).toHaveBeenCalledWith({
      where: { id: "experience", userId: "user" },
      data: expect.objectContaining({ workload: "40h" }),
    });
  });

  it("carrega subperfil global diretamente quando o id foi informado", async () => {
    prisma.careerProfile.findFirst.mockResolvedValue({
      id: "profile",
      userId: "user",
      profileName: "Perfil Global",
      isGlobal: true,
      skills: [],
      projects: [],
      experiences: [],
      courses: [],
      certifications: [],
      languages: [],
      educations: [],
      subprofileSkills: [],
      subprofileProjects: [],
      subprofileExperiences: [],
      subprofileCourses: [],
      subprofileCertifications: [],
      subprofileEducations: [],
      subprofileLanguages: [],
    });

    await expect(getProfile("user", "profile")).resolves.toMatchObject({ id: "profile" });
    expect(prisma.careerProfile.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.careerProfile.findFirst).toHaveBeenCalledWith({
      where: { id: "profile", userId: "user" },
      include: profileInclude,
    });
  });

  it("impede acessar subperfil de outro usuario", async () => {
    prisma.careerProfile.findFirst.mockResolvedValue(null);

    await expect(getProfile("user", "profile-from-other-user")).rejects.toMatchObject({
      statusCode: 404,
    });

    expect(prisma.careerProfile.findFirst).toHaveBeenCalledWith({
      where: { id: "profile-from-other-user", userId: "user" },
      include: profileInclude,
    });
  });

  it("seleciona apenas campos utilizados das colecoes de perfil", () => {
    expect(profileInclude.projects.select).toEqual(expect.objectContaining({ id: true, title: true, stack: true }));
    expect(profileInclude.projects.select.description).toBeUndefined();
    expect(profileInclude.projects.select.businessProblem).toBeUndefined();
    expect(profileInclude.subprofileProjects.select.project.select).toEqual(profileInclude.projects.select);
  });
});
