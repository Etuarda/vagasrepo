// npx node scripts/seed-onvagas15-coupon.js
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const coupon = await prisma.coupon.upsert({
    where: { code: "ONVAGAS15" },
    update: {},
    create: {
      code: "ONVAGAS15",
      description: "Acesso ao plano Pro por 15 dias",
      type: "percentage",
      value: 100,
      maxDiscountCents: null,
      appliesToPlans: ["premium"],
      duration: "once",
      maxRedemptions: null,
      redeemedCount: 0,
      maxRedemptionsPerUser: 1,
      trialDays: 15,
      expiresAt: null,
      active: true,
    },
  });

  console.log("Cupom criado:", {
    code: coupon.code,
    description: coupon.description,
    trialDays: coupon.trialDays,
    maxRedemptionsPerUser: coupon.maxRedemptionsPerUser,
    active: coupon.active,
  });
}

main()
  .catch((err) => { console.error(err); process.exit(1); })
  .finally(() => prisma.$disconnect());
