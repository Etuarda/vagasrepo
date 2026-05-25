jest.mock("../../lib/prisma", () => ({
  prisma: {
    resumeFile: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  },
}));
jest.mock("../../lib/cache", () => ({
  remember: jest.fn((namespace, owner, variant, loader) => loader()),
  invalidate: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("../profile.service", () => ({
  resolveProfile: jest.fn(),
}));

const { prisma } = require("../../lib/prisma");
const cache = require("../../lib/cache");
const profileService = require("../profile.service");
const { listResumeFiles, uploadResumeFile } = require("../resume-files.service");

describe("resume PDF attachment", () => {
  beforeEach(() => jest.clearAllMocks());

  it("salva apenas o arquivo como referencia sem extrair ou preencher o perfil", async () => {
    profileService.resolveProfile.mockResolvedValue({ id: "profile" });
    prisma.resumeFile.create.mockResolvedValue({
      id: "file",
      fileName: "cv.pdf",
      mimeType: "application/pdf",
      sizeBytes: 20,
      createdAt: new Date("2026-05-24T12:00:00.000Z"),
    });

    const result = await uploadResumeFile("user", {
      mimetype: "application/pdf",
      size: 20,
      buffer: Buffer.from("conteudo PDF nao lido"),
      originalname: "cv.pdf",
    }, "profile");

    expect(prisma.resumeFile.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user",
        profileId: "profile",
        content: expect.any(Buffer),
        extractedText: "",
      }),
    });
    expect(result).not.toHaveProperty("profile");
    expect(result).not.toHaveProperty("extractedText");
    expect(cache.invalidate).toHaveBeenCalledWith("resume-files", "user");
  });

  it("nao consulta o perfil novamente quando a lista de PDFs esta em cache", async () => {
    cache.remember.mockResolvedValueOnce([]);

    await expect(listResumeFiles("cached-user", "profile")).resolves.toEqual([]);

    expect(cache.remember).toHaveBeenCalledWith("resume-files", "cached-user", "profile", expect.any(Function));
    expect(profileService.resolveProfile).not.toHaveBeenCalled();
    expect(prisma.resumeFile.findMany).not.toHaveBeenCalled();
  });
});
