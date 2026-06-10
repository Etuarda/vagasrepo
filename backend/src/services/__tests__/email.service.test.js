const sendMock = jest.fn();

function loadService(config = {}) {
  jest.resetModules();
  jest.doMock("resend", () => ({
    Resend: jest.fn(() => ({ emails: { send: sendMock } })),
  }));
  jest.doMock("../../config/env", () => ({
    FRONTEND_URL: "https://onvagas.com.br",
    NODE_ENV: "production",
    RESEND_API_KEY: "re_test_key",
    EMAIL_FROM: "Vagason <no-reply@onvagas.com.br>",
    ...config,
  }));
  return require("../email.service");
}

describe("password reset e-mail delivery", () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it("envia a recuperacao pelo Resend com link e chave de idempotencia", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-id" }, error: null });
    const { sendPasswordResetEmail, resetEmailIdempotencyKey } = loadService();

    await expect(sendPasswordResetEmail(
      { name: "Pessoa & Teste", email: "pessoa@example.com" },
      "raw-token"
    )).resolves.toEqual({});

    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Vagason <no-reply@onvagas.com.br>",
        to: ["pessoa@example.com"],
        subject: "Redefinição de senha - Vagason",
      }),
      { idempotencyKey: resetEmailIdempotencyKey("raw-token") }
    );

    const body = sendMock.mock.calls[0][0];
    expect(body.text).toContain("resetToken=raw-token");
    expect(body.html).toContain("Pessoa &amp; Teste");
    expect(body.html).toContain("resetToken=raw-token");
  });

  it("oferece link de preview somente em desenvolvimento sem configuracao de e-mail", async () => {
    const { sendPasswordResetEmail } = loadService({
      NODE_ENV: "development",
      RESEND_API_KEY: undefined,
      EMAIL_FROM: undefined,
    });

    await expect(sendPasswordResetEmail(
      { name: "Pessoa", email: "pessoa@example.com" },
      "local-token"
    )).resolves.toEqual({
      previewUrl: "https://onvagas.com.br/?resetToken=local-token",
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("falha em producao quando a entrega nao esta configurada", async () => {
    const { sendPasswordResetEmail } = loadService({
      RESEND_API_KEY: undefined,
      EMAIL_FROM: undefined,
    });

    await expect(sendPasswordResetEmail(
      { name: "Pessoa", email: "pessoa@example.com" },
      "raw-token"
    )).rejects.toMatchObject({ statusCode: 503 });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("envia com remetente de teste somente para o destinatario autorizado", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-id" }, error: null });
    const { sendPasswordResetEmail } = loadService({
      EMAIL_FROM: "Vagas.io <onboarding@resend.dev>",
      RESEND_TEST_RECIPIENT: "pessoa@example.com",
    });

    await expect(sendPasswordResetEmail(
      { name: "Pessoa", email: "PESSOA@example.com" },
      "raw-token"
    )).resolves.toEqual({});
    expect(sendMock).toHaveBeenCalled();
  });

  it("bloqueia remetente de teste para outros usuarios em producao", async () => {
    const { sendPasswordResetEmail } = loadService({
      EMAIL_FROM: "Vagas.io <onboarding@resend.dev>",
      RESEND_TEST_RECIPIENT: "destinatario-autorizado@example.com",
    });

    await expect(sendPasswordResetEmail(
      { name: "Pessoa", email: "pessoa@example.com" },
      "raw-token"
    )).rejects.toMatchObject({
      statusCode: 503,
      message: expect.stringContaining("destinatario de teste"),
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("converte rejeicao do provedor em indisponibilidade temporaria", async () => {
    sendMock.mockResolvedValue({ data: null, error: { message: "Forbidden" } });
    const { sendPasswordResetEmail } = loadService();

    await expect(sendPasswordResetEmail(
      { name: "Pessoa", email: "pessoa@example.com" },
      "raw-token"
    )).rejects.toMatchObject({ statusCode: 503 });
  });
});
