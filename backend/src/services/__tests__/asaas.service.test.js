jest.mock("../../config/env", () => ({
  ASAAS_ENV: "sandbox",
  ASAAS_API_KEY: "asaas-secret",
  ASAAS_SUCCESS_URL: "https://gestaodevagas.vercel.app/plano?status=success",
}));

const asaasService = require("../asaas.service");
const env = require("../../config/env");

describe("asaas service", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ id: "sub" }),
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("usa ambiente sandbox e envia token somente ao provedor", async () => {
    await asaasService.createSubscription({
      customerId: "customer", plan: "pro", value: 19.9, description: "Plano Pro",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api-sandbox.asaas.com/v3/subscriptions",
      expect.objectContaining({
        headers: expect.objectContaining({ access_token: "asaas-secret" }),
        body: expect.stringContaining("\"nextDueDate\""),
      })
    );
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).callback).toEqual({
      successUrl: "https://gestaodevagas.vercel.app/plano?status=success",
      autoRedirect: true,
    });
  });

  it("retorna 503 quando a chave Asaas nao esta configurada", async () => {
    const configuredKey = env.ASAAS_API_KEY;
    env.ASAAS_API_KEY = undefined;

    await expect(asaasService.requestAsaas("/customers"))
      .rejects.toMatchObject({ statusCode: 503, message: "Integracao Asaas nao configurada." });

    env.ASAAS_API_KEY = configuredKey;
  });
});
