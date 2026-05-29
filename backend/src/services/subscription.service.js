const { prisma } = require("../lib/prisma");
const { PLAN_KEYS, FEATURES, PLAN_RULES, PLAN_DETAILS } = require("../constants/subscription-plans");

function planError(message, statusCode, code) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

function effectivePlan(subscription) {
  const configuredPlan = PLAN_RULES[subscription?.plan] ? subscription.plan : PLAN_KEYS.FREE;
  if (configuredPlan !== PLAN_KEYS.FREE && subscription?.status !== "active") return PLAN_KEYS.FREE;
  return configuredPlan;
}

function matchingPeriod(rules, now = new Date()) {
  if (rules.matchingPeriod === "lifetime") {
    return { key: "lifetime", start: null, end: null };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const key = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`;
  return { key, start, end };
}

async function lockQuotaScope(userId, feature, db) {
  if (typeof db.$executeRaw !== "function") return;
  const lockKey = `${feature}:${userId}`;
  await db.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
}

async function getOrCreateSubscription(userId, db = prisma) {
  return db.subscription.upsert({
    where: { userId },
    update: {},
    create: { userId, plan: PLAN_KEYS.FREE, status: "active" },
    include: { coupon: { select: { code: true } } },
  });
}

async function matchingUsage(userId, rules, db, now = new Date()) {
  const period = matchingPeriod(rules, now);
  const counter = await db.usageCounter.findUnique({
    where: {
      userId_feature_periodKey: {
        userId,
        feature: FEATURES.MATCHING_ANALYSIS,
        periodKey: period.key,
      },
    },
  });
  if (counter) return { period, used: counter.count };

  const where = { userId };
  if (period.start) where.createdAt = { gte: period.start, lt: period.end };
  const used = await db.jobAnalysis.count({ where });
  return { period, used };
}

async function getPlanContext(userId, db = prisma) {
  const subscription = await getOrCreateSubscription(userId, db);
  const plan = effectivePlan(subscription);
  const rules = PLAN_RULES[plan];
  const [{ period, used }, subprofilesUsed, trackedApplicationsUsed] = await Promise.all([
    matchingUsage(userId, rules, db),
    db.careerProfile.count({ where: { userId, isGlobal: false } }),
    db.job.count({ where: { userId } }),
  ]);

  return {
    subscription,
    plan,
    rules,
    availablePlans: Object.values(PLAN_KEYS).map((key) => ({
      key,
      ...PLAN_DETAILS[key],
      rules: PLAN_RULES[key],
    })),
    coupon: subscription.coupon ? { code: subscription.coupon.code } : null,
    features: {
      [FEATURES.MATCHING_ANALYSIS]: true,
      [FEATURES.SHARED_MATCHED_JOBS]: rules.sharedMatchedJobs,
      [FEATURES.SUBPROFILES]: rules.maxSubprofiles > 0,
      [FEATURES.APPLICATION_TRACKING]: rules.applicationTracking,
    },
    usage: {
      matching: {
        used,
        limit: rules.matchingLimit,
        period: rules.matchingPeriod,
        periodKey: period.key,
        remaining: Math.max(0, rules.matchingLimit - used),
      },
      subprofiles: {
        used: subprofilesUsed,
        limit: rules.maxSubprofiles,
        remaining: Math.max(0, rules.maxSubprofiles - subprofilesUsed),
      },
      applicationTracking: {
        used: trackedApplicationsUsed,
        limit: rules.maxTrackedApplications,
        remaining: rules.maxTrackedApplications === null
          ? null
          : Math.max(0, rules.maxTrackedApplications - trackedApplicationsUsed),
      },
    },
  };
}

async function assertFeatureAccess(userId, feature, db = prisma) {
  const subscription = await getOrCreateSubscription(userId, db);
  const plan = effectivePlan(subscription);
  const rules = PLAN_RULES[plan];
  if (feature === FEATURES.SHARED_MATCHED_JOBS && !rules.sharedMatchedJobs) {
    throw planError("Vagas compartilhadas nao estao incluidas no plano Free.", 403, "FEATURE_NOT_INCLUDED");
  }
  if (feature === FEATURES.APPLICATION_TRACKING && !rules.applicationTracking) {
    throw planError("Acompanhamento de vagas nao esta incluido no plano Free.", 403, "FEATURE_NOT_INCLUDED");
  }
  if (feature === FEATURES.SUBPROFILES && rules.maxSubprofiles <= 0) {
    throw planError("Subperfis nao estao incluidos no plano atual.", 403, "FEATURE_NOT_INCLUDED");
  }
  return { subscription, plan, rules };
}

async function consumeMatchingQuota(userId, db = prisma) {
  if (db === prisma) {
    return prisma.$transaction((tx) => consumeMatchingQuota(userId, tx));
  }

  await lockQuotaScope(userId, FEATURES.MATCHING_ANALYSIS, db);
  const { plan, rules } = await assertFeatureAccess(userId, FEATURES.MATCHING_ANALYSIS, db);
  const { period, used } = await matchingUsage(userId, rules, db);
  if (used >= rules.matchingLimit) {
    throw planError("Limite de analises de matching atingido para o plano atual.", 402, "MATCHING_LIMIT_REACHED");
  }

  const key = {
    userId_feature_periodKey: {
      userId,
      feature: FEATURES.MATCHING_ANALYSIS,
      periodKey: period.key,
    },
  };
  const existing = await db.usageCounter.findUnique({ where: key });
  if (!existing) {
    await db.usageCounter.create({
      data: {
        userId,
        feature: FEATURES.MATCHING_ANALYSIS,
        periodKey: period.key,
        count: used + 1,
      },
    });
    return { plan, used: used + 1, limit: rules.matchingLimit, periodKey: period.key };
  }

  const incremented = await db.usageCounter.updateMany({
    where: { id: existing.id, count: { lt: rules.matchingLimit } },
    data: { count: { increment: 1 } },
  });
  if (!incremented.count) {
    throw planError("Limite de analises de matching atingido para o plano atual.", 402, "MATCHING_LIMIT_REACHED");
  }
  return { plan, used: existing.count + 1, limit: rules.matchingLimit, periodKey: period.key };
}

async function assertSubprofileLimit(userId, db = prisma) {
  await lockQuotaScope(userId, FEATURES.SUBPROFILES, db);
  const { plan, rules } = await assertFeatureAccess(userId, FEATURES.SUBPROFILES, db);
  const count = await db.careerProfile.count({ where: { userId, isGlobal: false } });
  if (count >= rules.maxSubprofiles) {
    throw planError("Limite de subperfis atingido para o plano atual.", 402, "SUBPROFILE_LIMIT_REACHED");
  }
  return { plan, used: count, limit: rules.maxSubprofiles };
}

async function assertApplicationTrackingLimit(userId, db = prisma) {
  await lockQuotaScope(userId, FEATURES.APPLICATION_TRACKING, db);
  const { plan, rules } = await assertFeatureAccess(userId, FEATURES.APPLICATION_TRACKING, db);
  if (rules.maxTrackedApplications === null) return { plan, limit: null };
  const count = await db.job.count({ where: { userId } });
  if (count >= rules.maxTrackedApplications) {
    throw planError("Limite de vagas acompanhadas atingido para o plano atual.", 402, "APPLICATION_TRACKING_LIMIT_REACHED");
  }
  return { plan, used: count, limit: rules.maxTrackedApplications };
}

module.exports = {
  getOrCreateSubscription,
  getPlanContext,
  assertFeatureAccess,
  consumeMatchingQuota,
  assertSubprofileLimit,
  assertApplicationTrackingLimit,
  matchingPeriod,
};
