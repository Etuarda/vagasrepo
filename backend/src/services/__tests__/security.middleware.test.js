jest.mock("../../lib/redis", () => ({
  incrWithTtl: jest.fn(),
}));

const redis = require("../../lib/redis");
const { errorHandler } = require("../../middlewares/errorHandler");
const { securityHeaders, rateLimit, metricsEndpoint } = require("../../middlewares/security");

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
    type(value) {
      this.contentType = value;
      return this;
    },
    send: jest.fn(),
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

  it("protege metricas quando METRICS_TOKEN esta configurado", () => {
    const previous = process.env.METRICS_TOKEN;
    process.env.METRICS_TOKEN = "metrics-secret";
    const res = response();

    metricsEndpoint({ headers: {}, query: {} }, res);

    expect(res.statusCode).toBe(401);
    expect(res.send).toHaveBeenCalledWith("Unauthorized\n");
    if (previous === undefined) delete process.env.METRICS_TOKEN;
    else process.env.METRICS_TOKEN = previous;
  });

  it("redige dados sensiveis em logs de erro 500", () => {
    const previousEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});
    const res = response();
    const err = new Error("Falha com email pessoa@example.com cpf 123.456.789-10 Bearer abc.def.ghi");

    errorHandler(err, { requestId: "req", method: "POST", path: "/auth/login" }, res, jest.fn());

    const logged = spy.mock.calls[0][0];
    expect(logged).toContain("[EMAIL]");
    expect(logged).toContain("[CPF]");
    expect(logged).toContain("Bearer [REDACTED]");
    expect(logged).not.toContain("pessoa@example.com");
    expect(logged).not.toContain("123.456.789-10");
    spy.mockRestore();
    if (previousEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousEnv;
  });
});
