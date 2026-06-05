const crypto = require("crypto");
const env = require("../config/env");
const { prisma } = require("../lib/prisma");
const { PLAN_KEYS, PLAN_RULES } = require("../constants/subscription-plans");
const { isValidCpf } = require("../schemas/billing.schema");
const subscriptionService = require("./subscription.service");
const couponService = require("./coupon.service");
const asaasService = require("./asaas.service");
const emailService = require("./email.service");
const { encrypt, decrypt } = require("../lib/crypto");

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

async function saveBillingProfile(userId, { name, cpfCnpj, email }) {
  const normalized = digits(cpfCnpj);
  if (!isValidCpf(normalized)) throw billingError("CPF invalido.");
  await prisma.user.update({ where: { id: userId }, data: { name, cpfCnpj: encrypt(normalized), email } });
  return { saved: true };
}

function couponResponse(coupon, discountCents, finalPriceCents) {
  return coupon ? { code: coupon.code, discountCents, finalPriceCents } : null;
}

async function getPixData(providerSubscriptionId) {
  const payments = await asaasService.getSubscriptionPayments(providerSubscriptionId);
  const payment = payments.data?.[0];
  if (!payment?.id) return { pixQrCodeImage: null, pixCopyPaste: null, pixExpiresAt: null };
  const qr = await asaasService.getPixQrCode(payment.id);
  return {
    pixQrCodeImage: qr.encodedImage || null,
    pixCopyPaste: qr.payload || null,
    pixExpiresAt: qr.expirationDate || null,
  };
}

async function createCheckout(userId, { plan, couponCode }) {
  if (plan === PLAN_KEYS.FREE || !PLAN_RULES[plan]) {
    throw billingError("Plano invalido para checkout.");
  }
  console.log(JSON.stringify({ event: "checkout_started", userId, plan, hasCoupon: !!couponCode }));
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, phone: true, cpfCnpj: true },
  });
  if (!user) throw billingError("Usuario nao encontrado.", 404);
  if (!user.name?.trim() || !user.email?.trim()) {
    throw billingError("Informe nome completo e e-mail nos dados de cobranca antes de assinar.");
  }
  const rawCpf = decrypt(user.cpfCnpj || "");
  if (!isValidCpf(rawCpf)) {
    throw billingError("Informe um CPF valido nos dados de cobranca antes de assinar.");
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
      pixQrCodeImage: null,
      pixCopyPaste: null,
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
      cpfCnpj: digits(rawCpf),
      mobilePhone: digits(user.phone),
    });
    providerCustomerId = customer.id;
  }
  if (!providerCustomerId) throw billingError("Asaas nao retornou o identificador do cliente.", 502);

  const providerSubscription = await asaasService.createSubscription({
    customerId: providerCustomerId,
    plan,
    value: finalPriceCents / 100,
    description: "Vagas.io - Cobrancas Pix",
  });
  if (!providerSubscription.id) throw billingError("Asaas nao retornou a assinatura.", 502);

  // Salvar providerSubscriptionId imediatamente antes de buscar QR code.
  // Isso fecha a janela de race condition: se o webhook Asaas chegar durante
  // getPixData(), ele já consegue localizar a subscription pelo providerSubscriptionId.
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
      checkoutUrl: null,
      lastPaymentStatus: "PENDING",
      couponId: coupon?.id || null,
      originalPriceCents,
      discountCents,
      finalPriceCents,
    },
  });

  const pixData = await getPixData(providerSubscription.id);

  return {
    message: "Assinatura criada. Conclua o pagamento Pix para ativar o plano.",
    plan,
    coupon: couponResponse(coupon, discountCents, finalPriceCents),
    provider: "asaas",
    providerSubscriptionId: providerSubscription.id,
    pixQrCodeImage: pixData.pixQrCodeImage,
    pixCopyPaste: pixData.pixCopyPaste,
    pixExpiresAt: pixData.pixExpiresAt,
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
      console.log(JSON.stringify({
        event: "payment_confirmed",
        userId: subscription.userId,
        subscriptionId: subscription.id,
        plan,
        periodEnd: addMonth(now).toISOString(),
        asaasEventType: eventType,
      }));
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
      // Estorno e chargeback encerram o acesso ao plano imediatamente.
      // Overdue e cancelled mantêm o plan registrado (acesso controlado por effectivePlan).
      const terminatesAccess = eventType === "PAYMENT_REFUNDED" || eventType === "PAYMENT_CHARGEBACK_REQUESTED";
      await tx.subscription.update({
        where: { id: subscription.id },
        data: {
          status: PROBLEM_EVENTS[eventType],
          ...(terminatesAccess ? { plan: PLAN_KEYS.FREE, pendingPlan: null } : {}),
          lastPaymentStatus: payload.payment?.status || eventType,
          providerPaymentId: payload.payment?.id || subscription.providerPaymentId,
        },
      });
    }
    await tx.billingEvent.update({ where: { id: event.id }, data: { processedAt: new Date() } });
    return { processed: true };
  });
}

const REFUND_WINDOW_DAYS = 7;

async function requestRefund(userId, { reason }) {
  // Ownership: subscription é buscada pelo userId do token autenticado.
  // O providerPaymentId pertence exclusivamente a esta subscription.
  const subscription = await prisma.subscription.findUnique({ where: { userId } });

  if (!subscription) {
    throw billingError("Assinatura nao encontrada.", 404, "SUBSCRIPTION_NOT_FOUND");
  }

  // Impede estorno duplicado — status já foi marcado como refunded
  if (subscription.status === "refunded") {
    throw billingError("Estorno ja foi solicitado para esta assinatura.", 400, "ALREADY_REFUNDED");
  }

  if (subscription.status !== "active" || subscription.provider !== "asaas") {
    throw billingError("Nenhuma assinatura elegivel para estorno.", 400, "NOT_ELIGIBLE_FOR_REFUND");
  }
  if (!subscription.providerPaymentId) {
    throw billingError("Pagamento nao encontrado. Entre em contato com o suporte.", 400, "NO_PAYMENT_ID");
  }

  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - REFUND_WINDOW_DAYS);
  if (!subscription.currentPeriodStart || new Date(subscription.currentPeriodStart) < windowStart) {
    throw billingError(
      `Estorno disponivel apenas nos primeiros ${REFUND_WINDOW_DAYS} dias apos a assinatura.`,
      400,
      "REFUND_WINDOW_EXPIRED"
    );
  }

  // Chama Asaas ANTES de atualizar o banco.
  // Se Asaas falhar, o banco permanece inalterado e o usuario pode tentar novamente.
  // Se Asaas retornar erro de "already refunded", tratamos como idempotente abaixo.
  await asaasService.refundPayment(subscription.providerPaymentId);

  // Atualiza banco com advisory lock para evitar race condition entre
  // esta request e um webhook PAYMENT_REFUNDED que possa chegar simultaneamente.
  await prisma.$transaction(async (tx) => {
    if (typeof tx.$executeRaw === "function") {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"refund:" + userId}))`;
    }
    const current = await tx.subscription.findUnique({
      where: { userId },
      select: { status: true },
    });
    // Webhook pode ter processado o estorno antes desta transação
    if (current?.status === "refunded") return;

    await tx.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "refunded",
        plan: PLAN_KEYS.FREE,
        pendingPlan: null,
        refundReason: reason,
      },
    });
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
  if (user) emailService.sendRefundConfirmationEmail(user).catch(() => {});

  console.log(JSON.stringify({ event: "refund_requested", userId, subscriptionId: subscription.id, reason }));
  return { refunded: true };
}

async function cancelSubscription(userId) {
  const subscription = await prisma.subscription.findUnique({ where: { userId } });
  if (!subscription?.providerSubscriptionId || subscription.status !== "active") {
    throw billingError("Nenhuma assinatura ativa para cancelar.", 400, "NO_ACTIVE_SUBSCRIPTION");
  }
  await asaasService.cancelSubscription(subscription.providerSubscriptionId);
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "canceled", pendingPlan: null },
  });
  console.log(JSON.stringify({ event: "subscription_canceled", userId, subscriptionId: subscription.id }));
  return { canceled: true };
}

module.exports = {
  createCheckout,
  saveBillingProfile,
  requestRefund,
  cancelSubscription,
  processAsaasWebhook,
  assertWebhookToken,
};
