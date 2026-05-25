jest.mock("../../lib/prisma", () => ({
  prisma: {
    authSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  },
}));

jest.mock("../../lib/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
}));

const { prisma } = require("../../lib/prisma");
const redis = require("../../lib/redis");
const sessionService = require("../session.service");

describe("session.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("salva apenas hash do token ao criar sessao", async () => {
    await sessionService.createSession("user-1", "jwt-token", new Date(Date.now() + 60000));

    expect(prisma.authSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        tokenHash: expect.not.stringContaining("jwt-token"),
      }),
    });
    expect(redis.set).toHaveBeenCalled();
  });

  it("valida sessao ativa pelo banco quando nao ha cache", async () => {
    redis.get.mockResolvedValue(null);
    prisma.authSession.findFirst.mockResolvedValue({ expiresAt: new Date(Date.now() + 60000) });

    await expect(sessionService.validateSession("user-1", "jwt-token")).resolves.toBe(true);
    expect(prisma.authSession.findFirst).toHaveBeenCalled();
  });

  it("revoga todas as sessoes apos redefinicao de senha", async () => {
    prisma.authSession.findMany.mockResolvedValue([{ tokenHash: "hash-1" }, { tokenHash: "hash-2" }]);

    await sessionService.revokeAllUserSessions("user-1");

    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
    expect(redis.del).toHaveBeenCalledWith("session:hash-1");
    expect(redis.del).toHaveBeenCalledWith("session:hash-2");
  });
});
