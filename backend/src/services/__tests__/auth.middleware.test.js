jest.mock("jsonwebtoken", () => ({
  verify: jest.fn(() => ({ id: "user" })),
}));
jest.mock("../../config/env", () => ({
  JWT_SECRET: "secret-with-at-least-thirty-two-characters",
}));
jest.mock("../session.service", () => ({
  validateSession: jest.fn().mockResolvedValue(true),
}));

const sessionService = require("../session.service");
const { authMiddleware, cookieToken } = require("../../middlewares/auth");

describe("authenticated session cookie", () => {
  it("extrai token HttpOnly recebido no header cookie", () => {
    expect(cookieToken("other=value; vagas_session=signed%20token")).toBe("signed token");
  });

  it("autentica requisicao por cookie sem bearer exposto ao JavaScript", async () => {
    const req = { headers: { cookie: "vagas_session=session-token" } };
    const res = { status: jest.fn(() => res), json: jest.fn() };
    const next = jest.fn();

    await authMiddleware(req, res, next);

    expect(sessionService.validateSession).toHaveBeenCalledWith("user", "session-token");
    expect(req.userId).toBe("user");
    expect(next).toHaveBeenCalled();
  });
});
