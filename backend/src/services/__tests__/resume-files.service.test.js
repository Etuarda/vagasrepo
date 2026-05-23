const { parseResumeProfile } = require("../resume-files.service");

describe("parseResumeProfile", () => {
  it("separa projetos, experiencias, links e idiomas do texto extraido", () => {
    const text = `
Eduarda Silva Santos
Desenvolvedora Backend
eduarda@example.com | (89) 99936-6633 | linkedin.com/in/itseduarda | github.com/etuarda | lattes.cnpq.br/123

Resumo Profissional
Desenvolvedora backend com foco em Node.js, PostgreSQL e APIs REST.

Projetos
API de Vagas | Node.js | PostgreSQL
Construcao de API REST com autenticacao JWT e Prisma.
github.com/etuarda/api-vagas
app-vagas.vercel.app

Experiencia Profissional
Desenvolvedora Backend | Empresa XPTO | 2023 - Atual
Desenvolvimento de APIs, integracao com PostgreSQL e melhorias de performance.

Cursos
Node.js Avancado | Alura | 2024 | 20h

Certificacoes
AWS Cloud Practitioner | AWS | 2024

Idiomas
Ingles avancado, Espanhol intermediario
`;

    const parsed = parseResumeProfile(text);

    expect(parsed.emailContact).toBe("eduarda@example.com");
    expect(parsed.phone).toContain("99936");
    expect(parsed.linkedin).toContain("linkedin.com/in/itseduarda");
    expect(parsed.github).toContain("github.com/etuarda");
    expect(parsed.lattes).toContain("lattes.cnpq.br/123");
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0].repositoryUrl).toContain("github.com/etuarda/api-vagas");
    expect(parsed.experiences).toHaveLength(1);
    expect(parsed.courses).toHaveLength(1);
    expect(parsed.certifications).toHaveLength(1);
    expect(parsed.languages).toHaveLength(2);
  });
});
