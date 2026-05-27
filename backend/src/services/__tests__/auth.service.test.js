jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hashed-password"),
  compare: jest.fn(),
}));
jest.mock("../../config/env", () => ({
  JWT_SECRET: "secret-with-at-least-thirty-two-characters",
}));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));
jest.mock("../session.service", () => ({
  hashToken: jest.fn(() => "token-hash"),
  revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
  createSession: jest.fn(),
  revokeSession: jest.fn(),
}));
jest.mock("../email.service", () => ({
  sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
}));

const { prisma } = require("../../lib/prisma");
const sessionService = require("../session.service");
const emailService = require("../email.service");
const { registerUser, requestPasswordReset, resetPassword } = require("../auth.service");

describe("auth service registration and password reset", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.passwordResetToken.updateMany.mockResolvedValue({ count: 1 });
    prisma.passwordResetToken.create.mockResolvedValue({ id: "reset-record" });
    prisma.$transaction.mockImplementation(async (operation) => operation({
      passwordResetToken: { updateMany: prisma.passwordResetToken.updateMany },
      user: { update: prisma.user.update },
    }));
  });

  it("persiste telefone e cria sempre uma assinatura Free no cadastro", async () => {
    await registerUser({
      name: "Pessoa Teste",
      email: "pessoa@example.com",
      phone: "(85) 99999-0000",
      password: "senha-segura-123",
    });

    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        name: "Pessoa Teste",
        email: "pessoa@example.com",
        phone: "(85) 99999-0000",
        emailContact: "pessoa@example.com",
        password: "hashed-password",
        subscription: {
          create: { plan: "free", status: "active" },
        },
      },
    });
  });

  it("envia um link com token armazenado apenas como hash", async () => {
    prisma.user.findFirst.mockResolvedValue({ id: "user", name: "Pessoa", email: "pessoa@example.com" });

    await requestPasswordReset({ email: "pessoa@example.com" });

    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: {
        userId: "user",
        tokenHash: "token-hash",
        expiresAt: expect.any(Date),
      },
    });
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user" }),
      expect.any(String)
    );
  });

  it("nao revela se um email nao esta cadastrado", async () => {
    await expect(requestPasswordReset({ email: "desconhecido@example.com" })).resolves.toEqual({
      message: "Se o e-mail estiver cadastrado, enviaremos um link de recuperacao.",
    });
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it("consome o token, troca a senha e encerra sessoes ativas", async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue({ id: "reset-record", userId: "user" });

    await expect(resetPassword({ token: "raw-token", password: "nova-senha-segura" })).resolves.toEqual({
      message: "Senha redefinida. Entre novamente com sua nova senha.",
    });

    expect(sessionService.hashToken).toHaveBeenCalledWith("raw-token");
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: "user" },
      data: { password: "hashed-password" },
    });
    expect(sessionService.revokeAllUserSessions).toHaveBeenCalledWith("user");
  });
});
