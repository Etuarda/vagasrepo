const { prisma } = require("../lib/prisma");

function couponError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = "INVALID_COUPON";
  return err;
}

function normalizeCouponCode(code) {
  return String(code || "").trim().toUpperCase();
}

async function getCouponByCode(code, db = prisma) {
  const normalized = normalizeCouponCode(code);
  if (!normalized) return null;
  return db.coupon.findUnique({ where: { code: normalized } });
}

async function validateCouponForCheckout({ userId, plan, couponCode }, db = prisma) {
  const code = normalizeCouponCode(couponCode);
  if (!code) return null;

  const coupon = await getCouponByCode(code, db);
  if (!coupon) throw couponError("Cupom invalido.");
  if (!coupon.active) throw couponError("Cupom inativo.");

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) throw couponError("Cupom ainda nao esta disponivel.");
  if (coupon.expiresAt && coupon.expiresAt <= now) throw couponError("Cupom expirado.");
  if (coupon.maxRedemptions !== null && coupon.maxRedemptions !== undefined
      && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw couponError("Cupom esgotado.");
  }
  if (coupon.appliesToPlans?.length && !coupon.appliesToPlans.includes(plan)) {
    throw couponError("Cupom nao aplicavel a este plano.");
  }
  if (coupon.maxRedemptionsPerUser !== null && coupon.maxRedemptionsPerUser !== undefined) {
    const used = await db.couponRedemption.count({ where: { couponId: coupon.id, userId } });
    if (used >= coupon.maxRedemptionsPerUser) {
      throw couponError("Cupom ja utilizado por este usuario.");
    }
  }
  return coupon;
}

function calculateDiscount({ priceCents, coupon }) {
  if (!coupon) return { discountCents: 0, finalPriceCents: priceCents };

  let discountCents;
  if (coupon.type === "percentage") {
    discountCents = Math.floor(priceCents * coupon.value / 100);
  } else if (coupon.type === "fixed") {
    discountCents = coupon.value;
  } else {
    throw couponError("Tipo de cupom invalido.");
  }

  if (coupon.maxDiscountCents !== null && coupon.maxDiscountCents !== undefined) {
    discountCents = Math.min(discountCents, coupon.maxDiscountCents);
  }
  discountCents = Math.max(0, Math.min(priceCents, discountCents));
  return { discountCents, finalPriceCents: priceCents - discountCents };
}

function assertAllowedFullDiscount(coupon, priceCents, finalPriceCents) {
  if (finalPriceCents !== 0) return;
  const grantsFullDiscount = (coupon?.type === "percentage" && coupon.value >= 100)
    || (coupon?.type === "fixed" && coupon.value >= priceCents);
  if (!grantsFullDiscount || !coupon.maxRedemptions || !coupon.expiresAt) {
    throw couponError("Cupom de 100% requer limite de usos e data de expiracao.");
  }
}

async function redeemCoupon({
  tx,
  userId,
  subscriptionId,
  plan,
  coupon,
  originalPriceCents,
  discountCents,
  finalPriceCents,
}) {
  if (!coupon) return null;
  const redemption = await tx.couponRedemption.create({
    data: {
      couponId: coupon.id,
      userId,
      subscriptionId,
      plan,
      originalPriceCents,
      discountCents,
      finalPriceCents,
    },
  });
  await tx.coupon.update({
    where: { id: coupon.id },
    data: { redeemedCount: { increment: 1 } },
  });
  return redemption;
}

module.exports = {
  normalizeCouponCode,
  getCouponByCode,
  validateCouponForCheckout,
  calculateDiscount,
  assertAllowedFullDiscount,
  redeemCoupon,
};
