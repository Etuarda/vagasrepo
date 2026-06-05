jest.mock("../subscription.service", () => ({
  getPlanContext: jest.fn(),
}));
jest.mock("../billing.service", () => ({
  createCheckout: jest.fn(),
  saveBillingProfile: jest.fn(),
  processAsaasWebhook: jest.fn(),
}));

const subscriptionService = require("../subscription.service");
const billingService = require("../billing.service");
const { me, checkout, saveCustomer, asaasWebhook } = require("../../controllers/billing.controller");

describe("billing controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna o plano e uso do usuario autenticado", async () => {
    const context = { plan: "free", usage: { matching: { used: 0, limit: 3, remaining: 3 } } };
    subscriptionService.getPlanContext.mockResolvedValue(context);
    const res = { json: jest.fn() };

    await me({ userId: "user" }, res, jest.fn());

    expect(subscriptionService.getPlanContext).toHaveBeenCalledWith("user");
    expect(res.json).toHaveBeenCalledWith(context);
  });

  it("inicia checkout e retorna QR code Pix pendente", async () => {
    billingService.createCheckout.mockResolvedValue({ provider: "asaas", plan: "premium", pixCopyPaste: "00020126..." });
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await checkout({ userId: "user", body: { plan: "premium", couponCode: "DUDA50" } }, res, jest.fn());

    expect(billingService.createCheckout).toHaveBeenCalledWith("user", { plan: "premium", couponCode: "DUDA50" });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("salva dados de cobranca com nome, cpfCnpj e email", async () => {
    billingService.saveBillingProfile.mockResolvedValue({ saved: true });
    const res = { json: jest.fn() };

    await saveCustomer({
      userId: "user",
      body: { name: "Pessoa Teste", cpfCnpj: "123.456.789-09", email: "pessoa@example.com" },
    }, res, jest.fn());

    expect(billingService.saveBillingProfile).toHaveBeenCalledWith("user", {
      name: "Pessoa Teste",
      cpfCnpj: "123.456.789-09",
      email: "pessoa@example.com",
    });
  });

  it("encaminha webhook publico com token para processamento", async () => {
    billingService.processAsaasWebhook.mockResolvedValue({ processed: true });
    const res = { json: jest.fn() };

    await asaasWebhook({ headers: { "asaas-access-token": "token" }, body: { id: "evt" } }, res, jest.fn());

    expect(billingService.processAsaasWebhook).toHaveBeenCalledWith({ id: "evt" }, "token");
  });
});
