jest.mock("../../config/env", () => ({ ASAAS_WEBHOOK_TOKEN: "webhook-secret" }));
jest.mock("../../lib/prisma", () => ({
  prisma: {
    user: { findUnique: jest.fn(), update: jest.fn() },
    subscription: { update: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock("../subscription.service", () => ({
  getOrCreateSubscription: jest.fn(),
}));
jest.mock("../coupon.service", () => ({
  validateCouponForCheckout: jest.fn(),
  calculateDiscount: jest.fn(),
  assertAllowedFullDiscount: jest.fn(),
  redeemCoupon: jest.fn(),
}));
jest.mock("../asaas.service", () => ({
  createCustomer: jest.fn(),
  createSubscription: jest.fn(),
  getSubscriptionPayments: jest.fn(),
  createPixCharge: jest.fn(),
  getPixQrCode: jest.fn(),
}));
jest.mock("../credits.service", () => ({
  activateCredits: jest.fn().mockResolvedValue({ found: false }),
}));

const { prisma } = require("../../lib/prisma");
const subscriptionService = require("../subscription.service");
const couponService = require("../coupon.service");
const asaasService = require("../asaas.service");
const creditsService = require("../credits.service");
const billingService = require("../billing.service");

const baseSubscription = {
  id: "subscription",
  userId: "user",
  plan: "free",
  pendingPlan: "premium",
  providerCustomerId: null,
  couponId: null,
  originalPriceCents: 2490,
  discountCents: 0,
  finalPriceCents: 2490,
};

describe("billing checkout and webhook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({
      id: "user",
      name: "Pessoa",
      email: "pessoa@example.com",
      phone: "85999990000",
      cpfCnpj: "12345678909",
    });
    subscriptionService.getOrCreateSubscription.mockResolvedValue({ ...baseSubscription, pendingPlan: null });
    couponService.validateCouponForCheckout.mockResolvedValue(null);
    couponService.calculateDiscount.mockReturnValue({ discountCents: 0, finalPriceCents: 2490 });
    asaasService.createCustomer.mockResolvedValue({ id: "customer" });
    asaasService.createSubscription.mockResolvedValue({ id: "asaas-sub" });
    asaasService.getSubscriptionPayments.mockResolvedValue({ data: [{ invoiceUrl: "https://pay.example/invoice" }] });
  });

  it("rejeita checkout Free e exige CPF/CNPJ", async () => {
    await expect(billingService.createCheckout("user", { plan: "free" }))
      .rejects.toMatchObject({ statusCode: 400 });
    prisma.user.findUnique.mockResolvedValue({ id: "user", cpfCnpj: "" });
    await expect(billingService.createCheckout("user", { plan: "premium" }))
      .rejects.toMatchObject({ message: "Informe CPF/CNPJ antes de assinar." });
  });

  it("cria assinatura Asaas pendente e retorna URL de pagamento", async () => {
    const result = await billingService.createCheckout("user", { plan: "premium" });

    expect(asaasService.createSubscription).toHaveBeenCalledWith(expect.objectContaining({ value: 24.9, plan: "premium" }));
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ plan: "free", pendingPlan: "premium", status: "pending" }),
    }));
    expect(result.invoiceUrl).toBe("https://pay.example/invoice");
    expect(couponService.redeemCoupon).not.toHaveBeenCalled();
  });

  it("bloqueia cupom once em assinatura recorrente paga", async () => {
    couponService.validateCouponForCheckout.mockResolvedValue({ id: "coupon", code: "ONCE", duration: "once" });
    couponService.calculateDiscount.mockReturnValue({ discountCents: 100, finalPriceCents: 2390 });

    await expect(billingService.createCheckout("user", { plan: "premium", couponCode: "ONCE" }))
      .rejects.toMatchObject({ message: "Cupom de uso unico ainda nao esta disponivel para assinaturas recorrentes." });
    expect(asaasService.createSubscription).not.toHaveBeenCalled();
  });

  it("ativa cupom integral sem cobranca e registra resgate", async () => {
    const coupon = { id: "coupon", code: "FULL", duration: "once" };
    couponService.validateCouponForCheckout.mockResolvedValue(coupon);
    couponService.calculateDiscount.mockReturnValue({ discountCents: 2490, finalPriceCents: 0 });
    const tx = { subscription: { update: jest.fn().mockResolvedValue({ id: "subscription", status: "active" }) } };
    prisma.$transaction.mockImplementation((operation) => operation(tx));

    const result = await billingService.createCheckout("user", { plan: "premium", couponCode: "FULL" });

    expect(result).toEqual(expect.objectContaining({ status: "active", provider: "coupon", invoiceUrl: null }));
    expect(couponService.redeemCoupon).toHaveBeenCalled();
    expect(asaasService.createSubscription).not.toHaveBeenCalled();
  });

  function webhookTx(subscription = baseSubscription) {
    return {
      billingEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: "billing-event" }),
        update: jest.fn().mockResolvedValue({}),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(subscription),
        update: jest.fn().mockResolvedValue({}),
      },
      couponRedemption: { findFirst: jest.fn().mockResolvedValue(null) },
      coupon: { findUnique: jest.fn().mockResolvedValue({ id: "coupon" }) },
    };
  }

  it("rejeita webhook com token invalido", async () => {
    await expect(billingService.processAsaasWebhook({ id: "evt", event: "PAYMENT_RECEIVED" }, "wrong"))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it.each(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"])("ativa plano no evento %s", async (event) => {
    const tx = webhookTx();
    prisma.$transaction.mockImplementation((operation) => operation(tx));

    await billingService.processAsaasWebhook({
      id: `evt-${event}`,
      event,
      payment: { subscription: "provider-sub", id: "payment", status: "RECEIVED" },
    }, "webhook-secret");

    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "active", plan: "premium", pendingPlan: null }),
    }));
  });

  it("nao processa webhook duplicado", async () => {
    const tx = webhookTx();
    tx.billingEvent.findUnique.mockResolvedValue({ id: "already" });
    prisma.$transaction.mockImplementation((operation) => operation(tx));

    await expect(billingService.processAsaasWebhook({ id: "evt", event: "PAYMENT_RECEIVED" }, "webhook-secret"))
      .resolves.toEqual({ duplicated: true });
    expect(tx.subscription.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ["PAYMENT_OVERDUE", "past_due"],
    ["PAYMENT_REFUNDED", "refunded"],
  ])("muda status para %s sem apagar historico", async (event, status) => {
    const tx = webhookTx();
    prisma.$transaction.mockImplementation((operation) => operation(tx));

    await billingService.processAsaasWebhook({
      id: `evt-${event}`,
      event,
      payment: { subscription: "provider-sub", id: "payment", status: event },
    }, "webhook-secret");

    expect(tx.subscription.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status }),
    }));
  });

  it("resgata cupom uma unica vez na confirmacao", async () => {
    const tx = webhookTx({ ...baseSubscription, couponId: "coupon" });
    prisma.$transaction.mockImplementation((operation) => operation(tx));

    await billingService.processAsaasWebhook({
      id: "evt-paid",
      event: "PAYMENT_RECEIVED",
      payment: { subscription: "provider-sub", id: "payment", status: "RECEIVED" },
    }, "webhook-secret");
    expect(couponService.redeemCoupon).toHaveBeenCalledTimes(1);

    tx.couponRedemption.findFirst.mockResolvedValue({ id: "redemption" });
    await billingService.processAsaasWebhook({
      id: "evt-confirmed",
      event: "PAYMENT_CONFIRMED",
      payment: { subscription: "provider-sub", id: "payment", status: "CONFIRMED" },
    }, "webhook-secret");
    expect(couponService.redeemCoupon).toHaveBeenCalledTimes(1);
  });

  it("registra evento sem assinatura sem falhar", async () => {
    const tx = webhookTx(null);
    prisma.$transaction.mockImplementation((operation) => operation(tx));

    await expect(billingService.processAsaasWebhook({
      id: "evt-orphan", event: "PAYMENT_RECEIVED", payment: { subscription: "unknown" },
    }, "webhook-secret")).resolves.toEqual({ processed: true, subscriptionFound: false });
  });

  it("ativa creditos quando webhook de cobranca avulsa Pix e confirmado", async () => {
    creditsService.activateCredits.mockResolvedValue({ found: true, alreadyActive: false, userId: "user", credits: 500 });
    const tx = {
      ...webhookTx(null),
      billingEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((operation) => operation(tx));

    const result = await billingService.processAsaasWebhook({
      id: "evt-pix",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "charge_abc", subscription: null, status: "CONFIRMED" },
    }, "webhook-secret");

    expect(creditsService.activateCredits).toHaveBeenCalledWith("charge_abc", tx);
    expect(result).toEqual({ processed: true, creditPurchaseActivated: true });
  });

  it("nao duplica ativacao de creditos ja ativos", async () => {
    creditsService.activateCredits.mockResolvedValue({ found: true, alreadyActive: true });
    const tx = {
      ...webhookTx(null),
      billingEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementation((operation) => operation(tx));

    const result = await billingService.processAsaasWebhook({
      id: "evt-pix-dup",
      event: "PAYMENT_CONFIRMED",
      payment: { id: "charge_abc", subscription: null, status: "CONFIRMED" },
    }, "webhook-secret");

    expect(result).toEqual({ processed: true, creditPurchaseActivated: false });
  });
});
