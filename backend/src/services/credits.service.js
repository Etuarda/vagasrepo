const { prisma } = require("../lib/prisma");
const asaasService = require("./asaas.service");

const CREDIT_PACKAGE = Object.freeze({
  credits: 500,
  priceCents: 2990,
  label: "500 matchings avulsos",
});

function creditsError(message, statusCode = 400, code = "CREDITS_ERROR") {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

async function getOrCreateAsaasCustomer(userId, db = prisma) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user?.cpfCnpj) {
    throw creditsError("Informe CPF/CNPJ antes de comprar creditos.", 400, "CPF_CNPJ_REQUIRED");
  }

  const subscription = await db.subscription.findUnique({ where: { userId } });
  if (subscription?.providerCustomerId) {
    return subscription.providerCustomerId;
  }

  const customer = await asaasService.createCustomer({
    name: user.name,
    email: user.email,
    cpfCnpj: user.cpfCnpj,
    mobilePhone: user.phone || undefined,
  });

  await db.subscription.upsert({
    where: { userId },
    update: { providerCustomerId: customer.id },
    create: { userId, plan: "free", status: "active", providerCustomerId: customer.id },
  });

  return customer.id;
}

async function createCreditsCheckout(userId) {
  const customerId = await getOrCreateAsaasCustomer(userId);

  const charge = await asaasService.createPixCharge({
    customerId,
    value: CREDIT_PACKAGE.priceCents / 100,
    description: "Vagas.io - Cobranças Pix",
    externalReference: `credits:${userId}`,
  });

  const qrCode = await asaasService.getPixQrCode(charge.id);

  const purchase = await prisma.creditPurchase.create({
    data: {
      userId,
      asaasChargeId: charge.id,
      status: "pending",
      credits: CREDIT_PACKAGE.credits,
      priceCents: CREDIT_PACKAGE.priceCents,
      pixQrCodeImage: qrCode.encodedImage || null,
      pixCopyPaste: qrCode.payload || null,
      chargeExpiresAt: qrCode.expirationDate ? new Date(qrCode.expirationDate) : null,
    },
  });

  return {
    purchaseId: purchase.id,
    credits: purchase.credits,
    priceCents: purchase.priceCents,
    pixQrCodeImage: purchase.pixQrCodeImage,
    pixCopyPaste: purchase.pixCopyPaste,
    chargeExpiresAt: purchase.chargeExpiresAt,
  };
}

async function activateCredits(asaasChargeId, db = prisma) {
  const purchase = await db.creditPurchase.findUnique({
    where: { asaasChargeId },
  });

  if (!purchase) return { found: false };
  if (purchase.status === "active") return { found: true, alreadyActive: true };

  await db.creditPurchase.update({
    where: { id: purchase.id },
    data: { status: "active", activatedAt: new Date() },
  });

  await db.subscription.upsert({
    where: { userId: purchase.userId },
    update: { creditBalance: { increment: purchase.credits } },
    create: {
      userId: purchase.userId,
      plan: "free",
      status: "active",
      creditBalance: purchase.credits,
    },
  });

  return { found: true, alreadyActive: false, userId: purchase.userId, credits: purchase.credits };
}

async function getCreditBalance(userId) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { creditBalance: true },
  });
  return subscription?.creditBalance ?? 0;
}

module.exports = {
  CREDIT_PACKAGE,
  createCreditsCheckout,
  activateCredits,
  getCreditBalance,
};
