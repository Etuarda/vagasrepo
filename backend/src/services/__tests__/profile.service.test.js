jest.mock("../../lib/prisma", () => ({
  prisma: {
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

const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const { createProfile, deleteProfile, updateExperience } = require("../profile.service");

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
});
