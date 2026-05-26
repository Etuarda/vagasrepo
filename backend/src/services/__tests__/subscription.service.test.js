jest.mock("../../lib/prisma", () => ({ prisma: {} }));

const { FEATURES, PLAN_KEYS, PLAN_RULES } = require("../../constants/subscription-plans");
const {
  getPlanContext,
  assertFeatureAccess,
  consumeMatchingQuota,
  assertSubprofileLimit,
  assertApplicationTrackingLimit,
} = require("../subscription.service");

function dbFor(plan, options = {}) {
  const rules = PLAN_RULES[plan];
  return {
    subscription: {
      upsert: jest.fn().mockResolvedValue({ userId: "user", plan, status: options.status || "active" }),
    },
    usageCounter: {
      findUnique: jest.fn().mockResolvedValue(options.counter || null),
      create: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    jobAnalysis: {
      count: jest.fn().mockResolvedValue(options.matchingUsed || 0),
    },
    careerProfile: {
      count: jest.fn().mockResolvedValue(options.subprofilesUsed || 0),
    },
    job: {
      count: jest.fn().mockResolvedValue(options.applicationsUsed || 0),
    },
    rules,
  };
}

describe("subscription plans and quotas", () => {
  it("define os limites solicitados para todos os planos", () => {
    expect(PLAN_RULES.free).toEqual(expect.objectContaining({
      matchingLimit: 3, matchingPeriod: "lifetime", maxSubprofiles: 0, maxTrackedApplications: 10, sharedMatchedJobs: false,
    }));
    expect(PLAN_RULES.basic).toEqual(expect.objectContaining({ matchingLimit: 30, maxSubprofiles: 2 }));
    expect(PLAN_RULES.pro).toEqual(expect.objectContaining({ matchingLimit: 100, maxSubprofiles: 5 }));
    expect(PLAN_RULES.premium).toEqual(expect.objectContaining({ matchingLimit: 500, maxSubprofiles: 10 }));
  });

  it("permite as tres analises vitalicias do Free e bloqueia a quarta", async () => {
    const available = dbFor(PLAN_KEYS.FREE, { matchingUsed: 2 });
    await expect(consumeMatchingQuota("user", available)).resolves.toEqual(expect.objectContaining({ used: 3, limit: 3, periodKey: "lifetime" }));
    expect(available.usageCounter.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ count: 3, periodKey: "lifetime" }),
    }));

    const exhausted = dbFor(PLAN_KEYS.FREE, { matchingUsed: 3 });
    await expect(consumeMatchingQuota("user", exhausted)).rejects.toMatchObject({ statusCode: 402, code: "MATCHING_LIMIT_REACHED" });
  });

  it.each([
    [PLAN_KEYS.BASIC, 30],
    [PLAN_KEYS.PRO, 100],
    [PLAN_KEYS.PREMIUM, 500],
  ])("bloqueia %s ao atingir %i analises mensais", async (plan, limit) => {
    const db = dbFor(plan, { matchingUsed: limit });

    await expect(consumeMatchingQuota("user", db)).rejects.toMatchObject({ statusCode: 402 });
    expect(db.jobAnalysis.count).toHaveBeenCalledWith({
      where: { userId: "user", createdAt: { gte: expect.any(Date), lt: expect.any(Date) } },
    });
  });

  it("nega vagas compartilhadas para Free com 403 e permite para Basic", async () => {
    await expect(assertFeatureAccess("user", FEATURES.SHARED_MATCHED_JOBS, dbFor(PLAN_KEYS.FREE)))
      .rejects.toMatchObject({ statusCode: 403, code: "FEATURE_NOT_INCLUDED" });
    await expect(assertFeatureAccess("user", FEATURES.SHARED_MATCHED_JOBS, dbFor(PLAN_KEYS.BASIC)))
      .resolves.toMatchObject({ plan: PLAN_KEYS.BASIC });
  });

  it.each([
    [PLAN_KEYS.FREE, 0],
    [PLAN_KEYS.BASIC, 2],
    [PLAN_KEYS.PRO, 5],
    [PLAN_KEYS.PREMIUM, 10],
  ])("bloqueia subperfis do plano %s no limite %i sem contar Perfil Global", async (plan, limit) => {
    const db = dbFor(plan, { subprofilesUsed: limit });
    await expect(assertSubprofileLimit("user", db)).rejects.toMatchObject({ statusCode: 402, code: "SUBPROFILE_LIMIT_REACHED" });
    expect(db.careerProfile.count).toHaveBeenCalledWith({ where: { userId: "user", isGlobal: false } });
  });

  it("permite dez acompanhamentos no Free e bloqueia o decimo primeiro", async () => {
    await expect(assertApplicationTrackingLimit("user", dbFor(PLAN_KEYS.FREE, { applicationsUsed: 9 })))
      .resolves.toMatchObject({ limit: 10, used: 9 });
    await expect(assertApplicationTrackingLimit("user", dbFor(PLAN_KEYS.FREE, { applicationsUsed: 10 })))
      .rejects.toMatchObject({ statusCode: 402, code: "APPLICATION_TRACKING_LIMIT_REACHED" });
  });

  it("serializa a validacao de limite quando executada dentro de transacao", async () => {
    const db = dbFor(PLAN_KEYS.FREE, { applicationsUsed: 0 });
    db.$executeRaw = jest.fn().mockResolvedValue(undefined);

    await assertApplicationTrackingLimit("user", db);

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("retorna contexto de billing com uso e saldo remanescente", async () => {
    const context = await getPlanContext("user", dbFor(PLAN_KEYS.PRO, {
      matchingUsed: 12,
      subprofilesUsed: 2,
      applicationsUsed: 4,
    }));

    expect(context).toEqual(expect.objectContaining({
      plan: "pro",
      usage: expect.objectContaining({
        matching: expect.objectContaining({ used: 12, limit: 100, remaining: 88, period: "monthly" }),
        subprofiles: expect.objectContaining({ used: 2, limit: 5, remaining: 3 }),
      }),
    }));
  });
});
