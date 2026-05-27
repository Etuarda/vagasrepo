const crypto = require("crypto");
const env = require("../config/env");
const { prisma } = require("../lib/prisma");
const { PLAN_KEYS, PLAN_RULES } = require("../constants/subscription-plans");
const subscriptionService = require("./subscription.service");
const couponService = require("./coupon.service");
const asaasService = require("./asaas.service");

const PAID_EVENTS = new Set(["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"]);
const PROBLEM_EVENTS = Object.freeze({
  PAYMENT_OVERDUE: "past_due",
  PAYMENT_DELETED: "canceled",
  PAYMENT_REFUNDED: "refunded",
  PAYMENT_CHARGEBACK_REQUESTED: "chargeback",
});

function billingError(message, statusCode = 400, code = "BILLING_ERROR") {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function addMonth(date) {
  const end = new Date(date);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return end;
}

function digits(value) {
  return String(value || "").replace(/\D/g, "");
}

async function saveCustomerDocument(userId, cpfCnpj) {
  const normalized = digits(cpfCnpj);
  if (![11, 14].includes(normalized.length)) throw billingError("CPF/CNPJ invalido.");
  await prisma.user.update({ where: { id: userId }, data: { cpfCnpj: normalized } });
  return { cpfCnpjConfigured: true };
}

function couponResponse(coupon, discountCents, finalPriceCents) {
  return coupon ? { code: coupon.code, discountCents, finalPriceCents } : null;
}

async function getInvoiceUrl(providerSubscription) {
  if (providerSubscription.invoiceUrl) return providerSubscription.invoiceUrl;
  const payments = await asaasService.getSubscriptionPayments(providerSubscription.id);
  const payment = payments.data?.[0];
  return payment?.invoiceUrl || payment?.bankSlipUrl || null;
}

async function createCheckout(userId, { plan, couponCode }) {
  if (plan === PLAN_KEYS.FREE || !PLAN_RULES[plan]) {
    throw billingError("Plano invalido para checkout.");
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, cpfCnpj: true },
  });
  if (!user) throw billingError("Usuario nao encontrado.", 404);
  if (![11, 14].includes(digits(user.cpfCnpj).length)) {
    throw billingError("Informe CPF/CNPJ antes de assinar.");
  }

  const subscription = await subscriptionService.getOrCreateSubscription(userId);
  const coupon = await couponService.validateCouponForCheckout({ userId, plan, couponCode });
  const originalPriceCents = PLAN_RULES[plan].priceCents;
  const { discountCents, finalPriceCents } = couponService.calculateDiscount({ priceCents: originalPriceCents, coupon });
  couponService.assertAllowedFullDiscount(coupon, originalPriceCents, finalPriceCents);

  if (finalPriceCents === 0) {
    const now = new Date();
    const activated = await prisma.$transaction(async (tx) => {
      const saved = await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          plan,
          pendingPlan: null,
          status: "active",
          provider: "coupon",
          providerSubscriptionId: null,
          providerPaymentId: null,
          checkoutUrl: null,
          lastPaymentStatus: "PAID_BY_COUPON",
          couponId: coupon.id,
          originalPriceCents,
          discountCents,
          finalPriceCents,
          currentPeriodStart: now,
          currentPeriodEnd: addMonth(now),
        },
      });
      await couponService.redeemCoupon({
        tx,
        userId,
        subscriptionId: saved.id,
        plan,
        coupon,
        originalPriceCents,
        discountCents,
        finalPriceCents,
      });
      return saved;
    });
    return {
      message: "Plano ativado com cupom.",
      plan,
      status: activated.status,
      coupon: couponResponse(coupon, discountCents, finalPriceCents),
      provider: "coupon",
      invoiceUrl: null,
    };
  }

  if (coupon && coupon.duration !== "forever") {
    throw billingError("Cupom de uso unico ainda nao esta disponivel para assinaturas recorrentes.");
  }

  let providerCustomerId = subscription.providerCustomerId;
  if (!providerCustomerId) {
    const customer = await asaasService.createCustomer({
      name: user.name,
      email: user.email,
      cpfCnpj: digits(user.cpfCnpj),
      mobilePhone: digits(user.phone),
    });
    providerCustomerId = customer.id;
  }
  if (!providerCustomerId) throw billingError("Asaas nao retornou o identificador do cliente.", 502);

  const providerSubscription = await asaasService.createSubscription({
    customerId: providerCustomerId,
    plan,
    value: finalPriceCents / 100,
    description: `Vagas.io - plano ${plan}`,
    billingType: "UNDEFINED",
  });
  if (!providerSubscription.id) throw billingError("Asaas nao retornou a assinatura.", 502);
  const invoiceUrl = await getInvoiceUrl(providerSubscription);
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      plan: PLAN_KEYS.FREE,
      pendingPlan: plan,
      status: "pending",
      provider: "asaas",
      providerCustomerId,
      providerSubscriptionId: providerSubscription.id,
      providerPaymentId: null,
      checkoutUrl: invoiceUrl,
      lastPaymentStatus: "PENDING",
      couponId: coupon?.id || null,
      originalPriceCents,
      discountCents,
      finalPriceCents,
    },
  });
  return {
    message: "Assinatura criada. Conclua o pagamento para ativar o plano.",
    plan,
    coupon: couponResponse(coupon, discountCents, finalPriceCents),
    provider: "asaas",
    providerSubscriptionId: providerSubscription.id,
    invoiceUrl,
  };
}

function assertWebhookToken(receivedToken) {
  if (!env.ASAAS_WEBHOOK_TOKEN) throw billingError("Webhook Asaas nao configurado.", 503);
  const received = Buffer.from(String(receivedToken || ""));
  const configured = Buffer.from(env.ASAAS_WEBHOOK_TOKEN);
  if (received.length !== configured.length || !crypto.timingSafeEqual(received, configured)) {
    throw billingError("Webhook nao autorizado.", 401);
  }
}

async function processAsaasWebhook(payload, receivedToken) {
  assertWebhookToken(receivedToken);
  const eventId = String(payload?.id || "").trim();
  const eventType = String(payload?.event || "").trim();
  if (!eventId || !eventType) throw billingError("Evento Asaas invalido.");

  return prisma.$transaction(async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"asaas:" + eventId}))`;
    }
    const previous = await tx.billingEvent.findUnique({
      where: { provider_eventId: { provider: "asaas", eventId } },
    });
    if (previous) return { duplicated: true };

    const providerSubscriptionId = payload.payment?.subscription;
    if (providerSubscriptionId && typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"asaas-subscription:" + providerSubscriptionId}))`;
    }
    const subscription = providerSubscriptionId
      ? await tx.subscription.findFirst({ where: { providerSubscriptionId } })
      : null;
    const event = await tx.billingEvent.create({
      data: {
        provider: "asaas",
        eventId,
        eventType,
        userId: subscription?.userId || null,
        payload,
      },
    });
    if (!subscription) {
      await tx.billingEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
      return { processed: true, subscriptionFound: false };
    }

    if (PAID_EVENTS.has(eventType)) {
      const now = new Date();
      const plan = subscription.pendingPlan || subscription.plan;
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: "active",
          plan,
          pendingPlan: null,
          providerPaymentId: payload.payment?.id || null,
          lastPaymentStatus: payload.payment?.status || eventType,
          currentPeriodStart: now,
          currentPeriodEnd: addMonth(now),
        },
      });
      if (subscription.couponId) {
        const redeemed = await tx.couponRedemption.findFirst({
          where: { couponId: subscription.couponId, subscriptionId: subscription.id },
        });
        if (!redeemed) {
          const coupon = await tx.coupon.findUnique({ where: { id: subscription.couponId } });
          if (coupon) {
            await couponService.redeemCoupon({
              tx,
              userId: subscription.userId,
              subscriptionId: subscription.id,
              plan,
              coupon,
              originalPriceCents: subscription.originalPriceCents,
              discountCents: subscription.discountCents,
              finalPriceCents: subscription.finalPriceCents,
            });
          }
        }
      }
    } else if (PROBLEM_EVENTS[eventType]) {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: PROBLEM_EVENTS[eventType],
          lastPaymentStatus: payload.payment?.status || eventType,
          providerPaymentId: payload.payment?.id || subscription.providerPaymentId,
        },
      });
    }
    await tx.billingEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    return { processed: true };
  });
}

module.exports = {
  createCheckout,
  saveCustomerDocument,
  processAsaasWebhook,
  assertWebhookToken,
};
