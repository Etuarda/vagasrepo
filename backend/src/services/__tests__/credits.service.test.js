jest.mock("../../lib/prisma", () => ({ prisma: {} }));
jest.mock("../asaas.service", () => ({
  createCustomer: jest.fn(),
  createPixCharge: jest.fn(),
  getPixQrCode: jest.fn(),
}));

const { prisma } = require("../../lib/prisma");
const asaasService = require("../asaas.service");
const { createCreditsCheckout, activateCredits, getCreditBalance } = require("../credits.service");

const baseUser = { id: "user", name: "Pessoa", email: "p@example.com", phone: "85999990000", cpfCnpj: "12345678909" };

describe("credits service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user = { findUnique: jest.fn().mockResolvedValue(baseUser) };
    prisma.subscription = {
      findUnique: jest.fn().mockResolvedValue({ userId: "user", providerCustomerId: "cus_abc", creditBalance: 0 }),
      upsert: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    };
    prisma.creditPurchase = {
      create: jest.fn().mockResolvedValue({
        id: "purchase-1",
        credits: 500,
        priceCents: 2490,
        pixQrCodeImage: "base64img",
        pixCopyPaste: "00020126...",
        chargeExpiresAt: null,
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    };
    asaasService.createCustomer.mockResolvedValue({ id: "cus_new" });
    asaasService.createPixCharge.mockResolvedValue({ id: "charge_abc" });
    asaasService.getPixQrCode.mockResolvedValue({ encodedImage: "base64img", payload: "00020126...", expirationDate: null });
  });

  describe("createCreditsCheckout", () => {
    it("usa customer Asaas existente sem criar novo", async () => {
      const result = await createCreditsCheckout("user");

      expect(asaasService.createCustomer).not.toHaveBeenCalled();
      expect(asaasService.createPixCharge).toHaveBeenCalledWith(expect.objectContaining({
        customerId: "cus_abc",
        value: 14.9,
      }));
      expect(result.pixQrCodeImage).toBe("base64img");
      expect(result.pixCopyPaste).toBe("00020126...");
      expect(result.credits).toBe(500);
    });

    it("cria customer Asaas se ainda nao existir", async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await createCreditsCheckout("user");

      expect(asaasService.createCustomer).toHaveBeenCalledWith(expect.objectContaining({
        cpfCnpj: "12345678909",
      }));
    });

    it("rejeita usuario sem CPF/CNPJ", async () => {
      prisma.user.findUnique.mockResolvedValue({ ...baseUser, cpfCnpj: "" });

      await expect(createCreditsCheckout("user"))
        .rejects.toMatchObject({ statusCode: 400, code: "CPF_CNPJ_REQUIRED" });
    });

    it("salva CreditPurchase com status pending", async () => {
      await createCreditsCheckout("user");

      expect(prisma.creditPurchase.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          userId: "user",
          status: "pending",
          credits: 500,
          priceCents: 1490,
          asaasChargeId: "charge_abc",
        }),
      }));
    });
  });

  describe("activateCredits", () => {
    it("retorna found: false se cobranca nao existe", async () => {
      const result = await activateCredits("unknown-charge", prisma);
      expect(result).toEqual({ found: false });
    });

    it("retorna alreadyActive: true se ja foi ativado", async () => {
      prisma.creditPurchase.findUnique.mockResolvedValue({ id: "p1", status: "active", userId: "user", credits: 500 });
      const result = await activateCredits("charge_abc", prisma);
      expect(result).toEqual({ found: true, alreadyActive: true });
    });

    it("ativa compra pendente e incrementa saldo", async () => {
      prisma.creditPurchase.findUnique.mockResolvedValue({ id: "p1", status: "pending", userId: "user", credits: 500 });

      const result = await activateCredits("charge_abc", prisma);

      expect(result).toEqual({ found: true, alreadyActive: false, userId: "user", credits: 500 });
      expect(prisma.creditPurchase.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: "active" }),
      }));
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
        update: { creditBalance: { increment: 500 } },
      }));
    });
  });

  describe("getCreditBalance", () => {
    it("retorna saldo da subscription", async () => {
      prisma.subscription.findUnique.mockResolvedValue({ creditBalance: 123 });
      const balance = await getCreditBalance("user");
      expect(balance).toBe(123);
    });

    it("retorna 0 se subscription nao existe", async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);
      const balance = await getCreditBalance("user");
      expect(balance).toBe(0);
    });
  });
});
