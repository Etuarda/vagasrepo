jest.mock("../subscription.service", () => ({
  getPlanContext: jest.fn(),
  updatePlan: jest.fn(),
}));

const subscriptionService = require("../subscription.service");
const { me, update } = require("../../controllers/billing.controller");

describe("billing controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retorna o plano e uso do usuario autenticado", async () => {
    const context = {
      plan: "free",
      usage: {
        matching: { used: 0, limit: 3, remaining: 3 },
      },
    };
    subscriptionService.getPlanContext.mockResolvedValue(context);
    const res = { json: jest.fn() };

    await me({ userId: "user" }, res, jest.fn());

    expect(subscriptionService.getPlanContext).toHaveBeenCalledWith("user");
    expect(res.json).toHaveBeenCalledWith(context);
  });

  it("altera o plano solicitado pelo usuario autenticado", async () => {
    subscriptionService.updatePlan.mockResolvedValue({ plan: "premium" });
    const res = { json: jest.fn() };

    await update({ userId: "user", body: { plan: "premium" } }, res, jest.fn());

    expect(subscriptionService.updatePlan).toHaveBeenCalledWith("user", "premium");
    expect(res.json).toHaveBeenCalledWith({ plan: "premium" });
  });
});
