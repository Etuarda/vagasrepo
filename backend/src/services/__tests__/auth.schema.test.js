const { registerSchema, forgotPasswordSchema, resetPasswordSchema } = require("../../schemas/auth.schema");

describe("auth inputs", () => {
  it("exige nome, email, telefone e senha no cadastro", () => {
    const payload = registerSchema.parse({
      name: "Pessoa Teste",
      email: "PESSOA@EXAMPLE.COM",
      phone: "(85) 99999-0000",
      password: "senha-segura-123",
    });

    expect(payload.email).toBe("pessoa@example.com");
    expect(payload.phone).toBe("(85) 99999-0000");
    expect(payload.plan).toBe("free");
    expect(registerSchema.parse({ ...payload, plan: "pro" }).plan).toBe("pro");
    expect(() => registerSchema.parse({ ...payload, plan: "enterprise" })).toThrow();
    expect(() => registerSchema.parse({ ...payload, phone: "" })).toThrow();
    expect(() => registerSchema.parse({ ...payload, password: "curta" })).toThrow();
  });

  it("valida pedidos e confirmacoes de recuperacao", () => {
    expect(forgotPasswordSchema.parse({ email: "pessoa@example.com" }).email).toBe("pessoa@example.com");
    expect(resetPasswordSchema.parse({ token: "a".repeat(64), password: "nova-senha-segura" }).token).toHaveLength(64);
    expect(() => resetPasswordSchema.parse({ token: "invalido", password: "nova-senha-segura" })).toThrow();
  });
});
