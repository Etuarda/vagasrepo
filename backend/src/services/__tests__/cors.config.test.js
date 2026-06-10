const { HOSTED_FRONTEND_ORIGINS, compileOriginPattern, createOriginMatcher } = require("../../config/cors");

describe("CORS origin configuration", () => {
  it("aceita origem exata e preview restrito ao projeto Vercel configurado", () => {
    const allows = createOriginMatcher(HOSTED_FRONTEND_ORIGINS);

    expect(allows("https://onvagas.com.br")).toBe(true);
    expect(allows("https://gestaodevagas.vercel.app")).toBe(true);
    expect(allows("https://gestaodevagas-ntp28778w-eduardas-projects-9a8623c8.vercel.app")).toBe(true);
    expect(allows("https://outro-projeto-ntp28778w-eduardas-projects-9a8623c8.vercel.app")).toBe(false);
    expect(allows("https://gestaodevagas-ntp28778w-outro-time.vercel.app")).toBe(false);
  });

  it("recusa padrao que nao representa origem HTTPS", () => {
    expect(() => compileOriginPattern("http://*.vercel.app")).toThrow("Padrao CORS invalido");
    expect(() => compileOriginPattern("https://*.vercel.app/caminho")).toThrow("Padrao CORS invalido");
  });
});
