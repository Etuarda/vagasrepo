jest.mock("../subscription.service", () => ({
  getPlanContext: jest.fn(),
}));

const subscriptionService = require("../subscription.service");
const { me } = require("../../controllers/billing.controller");

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
});
