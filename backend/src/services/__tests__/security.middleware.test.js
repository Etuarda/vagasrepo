jest.mock("../../lib/redis", () => ({
  incrWithTtl: jest.fn(),
}));

const redis = require("../../lib/redis");
const { securityHeaders, rateLimit } = require("../../middlewares/security");

function response() {
  return {
    headers: {},
    statusCode: 200,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json: jest.fn(),
  };
}

describe("API security middleware", () => {
  beforeEach(() => jest.clearAllMocks());

  it("envia CSP, HSTS e impede cache para autenticacao", () => {
    const res = response();
    const next = jest.fn();

    securityHeaders({ path: "/auth/login" }, res, next);

    expect(res.headers["Strict-Transport-Security"]).toContain("max-age=31536000");
    expect(res.headers["Content-Security-Policy"]).toContain("default-src 'none'");
    expect(res.headers["Cache-Control"]).toBe("no-store");
    expect(next).toHaveBeenCalled();
  });

  it("usa Redis e informa limite restante ao cliente", async () => {
    redis.incrWithTtl.mockResolvedValue(2);
    const res = response();
    const next = jest.fn();

    await rateLimit({ windowMs: 60000, max: 5, keyPrefix: "auth" })({ ip: "127.0.0.1", headers: {}, socket: {} }, res, next);

    expect(res.headers["RateLimit-Limit"]).toBe(5);
    expect(res.headers["RateLimit-Remaining"]).toBe(3);
    expect(next).toHaveBeenCalled();
  });
});
