const { isValidCpf, billingCustomerSchema } = require("../../schemas/billing.schema");

describe("CPF validation", () => {
  it("aceita CPF valido", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
    expect(isValidCpf("111.444.777-35")).toBe(true);
  });

  it("rejeita CPF com digitos verificadores errados", () => {
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.444.777-34")).toBe(false);
  });

  it("rejeita CPF com todos os digitos iguais", () => {
    expect(isValidCpf("000.000.000-00")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("99999999999")).toBe(false);
  });

  it("rejeita string vazia ou com menos de 11 digitos", () => {
    expect(isValidCpf("")).toBe(false);
    expect(isValidCpf("1234567890")).toBe(false);
  });

  it("rejeita CNPJ (14 digitos)", () => {
    expect(isValidCpf("11.222.333/0001-81")).toBe(false);
  });

  it("billingCustomerSchema rejeita CPF invalido", () => {
    const result = billingCustomerSchema.safeParse({
      name: "Pessoa Teste",
      cpfCnpj: "000.000.000-00",
      email: "pessoa@example.com",
    });
    expect(result.success).toBe(false);
    expect(result.error.issues[0].message).toBe("CPF invalido");
  });

  it("billingCustomerSchema aceita dados validos", () => {
    const result = billingCustomerSchema.safeParse({
      name: "Pessoa Teste",
      cpfCnpj: "529.982.247-25",
      email: "pessoa@example.com",
    });
    expect(result.success).toBe(true);
    expect(result.data.cpfCnpj).toBe("529.982.247-25");
  });
});
