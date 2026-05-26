jest.mock("../../lib/redis", () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
}));

const redis = require("../../lib/redis");
const cache = require("../../lib/cache");

describe("redis read cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue(true);
    redis.incr.mockResolvedValue(1);
  });

  it("armazena o resultado carregado com expiracao", async () => {
    const loader = jest.fn().mockResolvedValue({ id: "profile" });

    await expect(cache.remember("profile", "user", "global", loader)).resolves.toEqual({ id: "profile" });

    expect(loader).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledWith(
      "cache:profile:user:v0:global",
      JSON.stringify({ id: "profile" }),
      cache.DEFAULT_CACHE_TTL_SECONDS
    );
  });

  it("retorna valor armazenado sem recarregar o banco", async () => {
    redis.get.mockResolvedValueOnce("3").mockResolvedValueOnce(JSON.stringify([{ id: "job" }]));
    const loader = jest.fn();

    await expect(cache.remember("jobs", "user", "all", loader)).resolves.toEqual([{ id: "job" }]);

    expect(loader).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("invalida o namespace incrementando sua versao", async () => {
    await cache.invalidate("match-history", "user");

    expect(redis.incr).toHaveBeenCalledWith("cache-version:match-history:user");
  });

  it("continua carregando do banco e registra degradacao quando Redis falha", async () => {
    const warning = jest.spyOn(console, "warn").mockImplementation(() => {});
    const loader = jest.fn().mockResolvedValue([{ id: "analysis" }]);
    redis.get.mockRejectedValue(new Error("redis unavailable"));
    redis.set.mockRejectedValue(new Error("redis unavailable"));

    await expect(cache.remember("match-history", "user", "profile", loader, 120))
      .resolves.toEqual([{ id: "analysis" }]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('"event":"cache_degraded"'));
    warning.mockRestore();
  });

  it("reutiliza cache local quando Redis nao esta configurado", async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue(false);
    const loader = jest.fn().mockResolvedValue({ id: "local-profile" });

    await cache.remember("profile", "local-user", "subprofile", loader);
    await cache.remember("profile", "local-user", "subprofile", loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("remove leitura local apos invalidacao", async () => {
    redis.get.mockResolvedValue(null);
    redis.set.mockResolvedValue(false);
    redis.incr.mockResolvedValue(null);
    const loader = jest.fn()
      .mockResolvedValueOnce({ value: "old" })
      .mockResolvedValueOnce({ value: "new" });

    await cache.remember("profile", "edited-user", "subprofile", loader);
    await cache.invalidate("profile", "edited-user");
    await expect(cache.remember("profile", "edited-user", "subprofile", loader))
      .resolves.toEqual({ value: "new" });

    expect(loader).toHaveBeenCalledTimes(2);
  });
});
