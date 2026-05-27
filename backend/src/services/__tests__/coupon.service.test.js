jest.mock("../../lib/prisma", () => ({ prisma: {} }));

const {
  normalizeCouponCode,
  validateCouponForCheckout,
  calculateDiscount,
  assertAllowedFullDiscount,
  redeemCoupon,
} = require("../coupon.service");

function coupon(overrides = {}) {
  return {
    id: "coupon",
    code: "DUDA50",
    active: true,
    type: "percentage",
    value: 50,
    maxDiscountCents: null,
    appliesToPlans: [],
    duration: "forever",
    maxRedemptions: 10,
    redeemedCount: 0,
    maxRedemptionsPerUser: 1,
    startsAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    ...overrides,
  };
}

function db(record) {
  return {
    coupon: { findUnique: jest.fn().mockResolvedValue(record) },
    couponRedemption: { count: jest.fn().mockResolvedValue(0) },
  };
}

describe("coupon service", () => {
  it("normaliza codigo com trim e uppercase", () => {
    expect(normalizeCouponCode(" duda50 ")).toBe("DUDA50");
  });

  it("retorna erros controlados para cupom inexistente, inativo e expirado", async () => {
    await expect(validateCouponForCheckout({ userId: "u", plan: "pro", couponCode: "x" }, db(null)))
      .rejects.toMatchObject({ statusCode: 400, message: "Cupom invalido." });
    await expect(validateCouponForCheckout({ userId: "u", plan: "pro", couponCode: "x" }, db(coupon({ active: false }))))
      .rejects.toMatchObject({ message: "Cupom inativo." });
    await expect(validateCouponForCheckout({ userId: "u", plan: "pro", couponCode: "x" }, db(coupon({ expiresAt: new Date(0) }))))
      .rejects.toMatchObject({ message: "Cupom expirado." });
  });

  it("valida periodo, estoque, plano e uso por usuario", async () => {
    await expect(validateCouponForCheckout({ userId: "u", plan: "pro", couponCode: "x" }, db(coupon({ startsAt: new Date(Date.now() + 86400000) }))))
      .rejects.toMatchObject({ message: "Cupom ainda nao esta disponivel." });
    await expect(validateCouponForCheckout({ userId: "u", plan: "pro", couponCode: "x" }, db(coupon({ maxRedemptions: 1, redeemedCount: 1 }))))
      .rejects.toMatchObject({ message: "Cupom esgotado." });
    await expect(validateCouponForCheckout({ userId: "u", plan: "pro", couponCode: "x" }, db(coupon({ appliesToPlans: ["basic"] }))))
      .rejects.toMatchObject({ message: "Cupom nao aplicavel a este plano." });
    const used = db(coupon());
    used.couponRedemption.count.mockResolvedValue(1);
    await expect(validateCouponForCheckout({ userId: "u", plan: "pro", couponCode: "x" }, used))
      .rejects.toMatchObject({ message: "Cupom ja utilizado por este usuario." });
  });

  it("calcula percentual, fixo, teto e impede saldo negativo", () => {
    expect(calculateDiscount({ priceCents: 1990, coupon: coupon() })).toEqual({ discountCents: 995, finalPriceCents: 995 });
    expect(calculateDiscount({ priceCents: 990, coupon: coupon({ type: "fixed", value: 500 }) }))
      .toEqual({ discountCents: 500, finalPriceCents: 490 });
    expect(calculateDiscount({ priceCents: 1990, coupon: coupon({ maxDiscountCents: 300 }) }))
      .toEqual({ discountCents: 300, finalPriceCents: 1690 });
    expect(calculateDiscount({ priceCents: 990, coupon: coupon({ type: "fixed", value: 5000 }) }))
      .toEqual({ discountCents: 990, finalPriceCents: 0 });
  });

  it("permite cupom integral somente com expiracao e limite de usos", () => {
    expect(() => assertAllowedFullDiscount(coupon({ value: 100 }), 1990, 0)).not.toThrow();
    expect(() => assertAllowedFullDiscount(coupon({ value: 100, maxRedemptions: null }), 1990, 0))
      .toThrow("Cupom de 100% requer limite de usos e expiracao.");
  });

  it("audita resgate e incrementa uso uma unica vez por chamada confirmada", async () => {
    const tx = {
      couponRedemption: { create: jest.fn().mockResolvedValue({ id: "redemption" }) },
      coupon: { update: jest.fn().mockResolvedValue({}) },
    };

    await redeemCoupon({
      tx,
      userId: "user",
      subscriptionId: "subscription",
      plan: "pro",
      coupon: coupon(),
      originalPriceCents: 1990,
      discountCents: 995,
      finalPriceCents: 995,
    });

    expect(tx.couponRedemption.create).toHaveBeenCalledTimes(1);
    expect(tx.coupon.update).toHaveBeenCalledWith({
      where: { id: "coupon" },
      data: { redeemedCount: { increment: 1 } },
    });
  });
});
