jest.mock("../auth.service", () => ({
  loginUser: jest.fn(),
}));

const authService = require("../auth.service");
const { login } = require("../../controllers/auth.controller");

describe("login session delivery", () => {
  it("entrega sessao de producao em cookie HttpOnly sem expor JWT no JSON", async () => {
    authService.loginUser.mockResolvedValue({
      token: "signed-token",
      user: { name: "Pessoa", email: "pessoa@example.com" },
    });
    const req = {
      headers: { origin: "https://onvagas.com.br" },
      body: { email: "pessoa@example.com", password: "senha-segura-123" },
    };
    const res = { setHeader: jest.fn(), json: jest.fn() };

    await login(req, res, jest.fn());

    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("HttpOnly"));
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("Path=/api"));
    expect(res.setHeader).toHaveBeenCalledWith("Set-Cookie", expect.stringContaining("SameSite=Strict"));
    expect(res.json).toHaveBeenCalledWith({
      user: { name: "Pessoa", email: "pessoa@example.com" },
    });
  });
});
