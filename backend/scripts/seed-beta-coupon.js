// npx node scripts/seed-beta-coupon.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 15);
  expiresAt.setUTCHours(23, 59, 59, 999);

  const coupon = await prisma.coupon.upsert({
    where: { code: "BETA100" },
    update: {},
    create: {
      code: "BETA100",
      description: "Acesso beta — Plano Pro por 30 dias",
      type: "percentage",
      value: 100,
      maxDiscountCents: null,
      appliesToPlans: ["premium"],
      duration: "once",
      maxRedemptions: 100,
      redeemedCount: 0,
      maxRedemptionsPerUser: 1,
      expiresAt,
      active: true,
    },
  });

  console.log("Cupom upserted:", {
    code: coupon.code,
    expiresAt: coupon.expiresAt,
    maxRedemptions: coupon.maxRedemptions,
    active: coupon.active,
  });
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
