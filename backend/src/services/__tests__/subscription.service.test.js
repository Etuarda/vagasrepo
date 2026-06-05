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
      upsert: jest.fn().mockResolvedValue({
        userId: "user",
        plan,
        status: options.status || "active",
        currentPeriodEnd: options.currentPeriodEnd,
      }),
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
    user: {
      findUnique: jest.fn().mockResolvedValue({
        name: options.userName || "Pessoa",
        email: options.userEmail || "pessoa@example.com",
        cpfCnpj: options.userCpfCnpj || "12345678909",
      }),
    },
    rules,
  };
}

describe("subscription plans and quotas", () => {
  it("define os limites solicitados para todos os planos", () => {
    expect(PLAN_RULES.free).toEqual(expect.objectContaining({
      matchingLimit: 3,
      matchingPeriod: "lifetime",
      maxSubprofiles: 0,
      maxTrackedApplications: 0,
      sharedMatchedJobs: false,
      applicationTracking: false,
    }));
    expect(PLAN_RULES.premium).toEqual(expect.objectContaining({
      matchingLimit: 500,
      matchingPeriod: "monthly",
      maxSubprofiles: 10,
      maxTrackedApplications: null,
      sharedMatchedJobs: true,
      applicationTracking: true,
    }));
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

  it("bloqueia premium ao atingir 500 analises mensais", async () => {
    const db = dbFor(PLAN_KEYS.PREMIUM, { matchingUsed: 500 });

    await expect(consumeMatchingQuota("user", db)).rejects.toMatchObject({ statusCode: 402 });
    expect(db.jobAnalysis.count).toHaveBeenCalledWith({
      where: { userId: "user", createdAt: { gte: expect.any(Date), lt: expect.any(Date) } },
    });
  });

  it("nega vagas compartilhadas para Free com 403 e permite para Premium", async () => {
    await expect(assertFeatureAccess("user", FEATURES.SHARED_MATCHED_JOBS, dbFor(PLAN_KEYS.FREE)))
      .rejects.toMatchObject({ statusCode: 403, code: "FEATURE_NOT_INCLUDED" });
    await expect(assertFeatureAccess("user", FEATURES.SHARED_MATCHED_JOBS, dbFor(PLAN_KEYS.PREMIUM)))
      .resolves.toMatchObject({ plan: PLAN_KEYS.PREMIUM });
  });

  it("bloqueia subperfis do plano premium no limite 10 sem contar Perfil Global", async () => {
    const db = dbFor(PLAN_KEYS.PREMIUM, { subprofilesUsed: 10 });
    await expect(assertSubprofileLimit("user", db)).rejects.toMatchObject({ statusCode: 402, code: "SUBPROFILE_LIMIT_REACHED" });
    expect(db.careerProfile.count).toHaveBeenCalledWith({ where: { userId: "user", isGlobal: false } });
  });

  it("nega subperfis para o plano free com limite atingido", async () => {
    await expect(assertSubprofileLimit("user", dbFor(PLAN_KEYS.FREE)))
      .rejects.toMatchObject({ statusCode: 402, code: "SUBPROFILE_LIMIT_REACHED" });
  });

  it("nega acompanhamento de vagas no Free", async () => {
    await expect(assertApplicationTrackingLimit("user", dbFor(PLAN_KEYS.FREE, { applicationsUsed: 0 })))
      .rejects.toMatchObject({ statusCode: 403, code: "FEATURE_NOT_INCLUDED" });
  });

  it("nao aplica limite visivel de acompanhamento no plano premium", async () => {
    const db = dbFor(PLAN_KEYS.PREMIUM, { applicationsUsed: 10000 });
    await expect(assertApplicationTrackingLimit("user", db)).resolves.toMatchObject({ plan: PLAN_KEYS.PREMIUM, limit: null });
    expect(db.job.count).not.toHaveBeenCalled();
  });

  it("serializa a validacao de limite quando executada dentro de transacao", async () => {
    const db = dbFor(PLAN_KEYS.PREMIUM, { applicationsUsed: 0 });
    db.$executeRaw = jest.fn().mockResolvedValue(undefined);

    await assertApplicationTrackingLimit("user", db);

    expect(db.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("retorna contexto de billing com uso, saldo e perfil de cobranca", async () => {
    const context = await getPlanContext("user", dbFor(PLAN_KEYS.PREMIUM, {
      matchingUsed: 12,
      subprofilesUsed: 2,
      applicationsUsed: 4,
      userName: "Pessoa Teste",
      userEmail: "pessoa@example.com",
      userCpfCnpj: "12345678909",
    }));

    expect(context).toEqual(expect.objectContaining({
      plan: "premium",
      usage: expect.objectContaining({
        matching: expect.objectContaining({ used: 12, limit: 500, remaining: 488, period: "monthly" }),
        subprofiles: expect.objectContaining({ used: 2, limit: 10, remaining: 8 }),
      }),
      billingProfile: expect.objectContaining({
        name: "Pessoa Teste",
        email: "pessoa@example.com",
        cpfCnpj: "12345678909",
      }),
    }));
  });

  it("mantem regras Free enquanto o pagamento do plano pago esta pendente", async () => {
    const context = await getPlanContext("user", dbFor(PLAN_KEYS.PREMIUM, { status: "pending" }));

    expect(context.plan).toBe(PLAN_KEYS.FREE);
    expect(context.rules.matchingLimit).toBe(3);
  });

  it("mantem regras Free quando o plano pago esta cancelado ou expirado", async () => {
    await expect(assertSubprofileLimit("user", dbFor(PLAN_KEYS.PREMIUM, { status: "canceled" })))
      .rejects.toMatchObject({ statusCode: 402, code: "SUBPROFILE_LIMIT_REACHED" });

    await expect(assertSubprofileLimit("user", dbFor(PLAN_KEYS.PREMIUM, {
      currentPeriodEnd: new Date("2026-01-01T00:00:00.000Z"),
    }))).rejects.toMatchObject({ statusCode: 402, code: "SUBPROFILE_LIMIT_REACHED" });
  });
});
