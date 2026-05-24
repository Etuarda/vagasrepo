jest.mock("../../lib/prisma", () => ({
  prisma: {
    resumeFile: {
      create: jest.fn(),
    },
  },
}));
jest.mock("../profile.service", () => ({
  resolveProfile: jest.fn(),
}));

const { prisma } = require("../../lib/prisma");
const profileService = require("../profile.service");
const { uploadResumeFile } = require("../resume-files.service");

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
  });
});
