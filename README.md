# Smart Resume Matcher

## Visao geral

Smart Resume Matcher e uma aplicacao SaaS para manter uma base profissional confiavel e compilar curriculos direcionados a vagas. O candidato cadastra seus dados reais uma vez, organiza estrategias por subperfil e recebe um curriculo compacto baseado em aderencia verificavel.

O produto nao utiliza IA generativa, LLM ou servicos externos de geracao textual. Ele seleciona, ordena e formata informacoes previamente cadastradas.

## Funcionalidades

- Perfil Global com contato, resumo, formacao, experiencias, skills, projetos, cursos, certificacoes e idiomas.
- Subperfis como Backend, Dados ou Fullstack, com heranca por vinculo dos itens globais.
- Projetos estruturados com stack, links, solucao tecnica, arquitetura e bullets reutilizaveis.
- Analise deterministica de descricao de vaga com keywords normalizadas e categoria profissional.
- Ranking explicavel de skills, projetos, bullets, cursos, certificacoes e experiencias.
- Curriculo PDF compacto, ATS-friendly, com no maximo dois projetos e tres bullets por projeto.
- Historico de analises editavel e versionado, com estados `draft`, `reviewed`, `applied`, `archived` e `rejected`.
- Registro opcional de candidatura a partir do curriculo gerado, vinculado a analise e ao PDF utilizado.
- Registro da data de aplicacao ao marcar um curriculo como aplicado.
- Camada preparada para metadados de exportacao Google Docs, sem OAuth no MVP.

## Diferencial

Toda informacao exibida no curriculo vem do Perfil Global ou de um Subperfil do usuario. Skills ausentes sao apresentadas somente como lacunas da vaga, nunca como experiencia do candidato. Essa abordagem torna o resultado auditavel e evita texto ou qualificacoes fabricadas.

## Stack

- Frontend: HTML, Tailwind via CDN e JavaScript modular.
- Backend: Node.js, Express e CommonJS.
- Banco: PostgreSQL.
- ORM e migrations: Prisma.
- Autenticacao: JWT com sessao revogavel e senha com `bcryptjs`.
- Validacao: Zod.
- PDF: `pdf-lib`.
- Testes: Jest.
- Protecoes: CORS por ambiente, security headers, rate limiting, limite de JSON/PDF e consultas isoladas por `userId`.

## Arquitetura

O backend preserva as rotas existentes e adiciona modulos incrementais:

```text
backend/src/
  modules/
    matching/
      keyword-normalizer.js
      project-ranking.service.js
    resume/
      resume-compiler.service.js
      resume-layout.service.js
    google-docs/
      google-docs-export.service.js
  shared/constants/
    tech-dictionary.js
  services/
    profile.service.js
    matching.service.js
    pdf-output.service.js
```

`profile.service.js` mantem compatibilidade com os endpoints atuais. Novos subperfis vinculam itens globais por tabelas `Subprofile*`, evitando copias desnecessarias. `matching.service.js` coordena persistencia e chama os modulos puros testaveis.

## Modelo de dados

- `CareerProfile`: representa o Perfil Global (`isGlobal`) e os subperfis.
- `Skill`, `Education`, `Experience`, `Course`, `Certification` e `Language`: base factual do candidato.
- `Project`, `ProjectTechnology` e `ProjectBullet`: portifolio estruturado e evidencias selecionaveis.
- `SubprofileSkill`, `SubprofileProject`, `SubprofileExperience`, `SubprofileCourse` e `SubprofileCertification`: selecao, visibilidade, peso e adaptacao por estrategia.
- `JobAnalysis`: descricao, categoria, score, selecoes, status e encadeamento de versoes.
- `OptimizedResume`: snapshot da selecao e arquivo PDF gerado.
- `Job`: candidatura acompanhada no painel; quando originada pelo matching, referencia `JobAnalysis` e `OptimizedResume`.
- `GoogleDocsExport`: metadados reservados para exportacao futura.

Dados legados de subperfis clonados continuam legiveis. Novos subperfis usam vinculacao ao Perfil Global.

## Matching

A descricao da vaga e normalizada por dicionario tecnico, por exemplo: `Node.js` vira `nodejs`, `Postgres` vira `postgresql` e `APIs REST` vira `api-rest`. O motor classifica a vaga em `backend`, `frontend`, `fullstack`, `data`, `ai`, `devops`, `qa`, `product` ou `unknown`.

A formula do score final e:

```text
45% skills compativeis
30% projetos compativeis
15% cursos/certificacoes compativeis
10% experiencias compativeis
```

O resultado separa `matchedSkills` de `missingSkills`, limita o curriculo a dois projetos, seleciona ate tres bullets cadastrados por projeto e informa a justificativa do ranking.

## Registro de candidatura

Depois de gerar um curriculo otimizado, a interface oferece registrar a vaga em Candidaturas. O endpoint `POST /job-analyses/:id/create-application` recebe somente links, fase, acao, feedback e observacoes; titulo, empresa, descricao original, score, subperfil, skills e projetos permanecem derivados da analise vinculada.

A candidatura nasce com status `Ativa` e fase `Curriculo gerado`, salvo se o usuario escolher outra fase no formulario. Gerar curriculo nao marca a vaga como aplicada. Se a fase `Aplicada` for escolhida explicitamente, a data de aplicacao e registrada. Uma segunda candidatura para a mesma analise exige confirmacao explicita.

## Layout do curriculo

O compilador prioriza uma pagina:

- cabecalho em uma linha compacta abaixo do nome;
- resumo com ate 420 caracteres;
- habilidades em fluxo continuo e ate duas linhas;
- ate dois projetos com ate tres bullets factuais;
- ate dois bullets por experiencia;
- cursos e certificacoes em linha continua, com ate cinco itens;
- idiomas em linha unica.

Se o conteudo exceder os limites, a compilacao reduz itens de menor prioridade e textos longos antes de permitir crescimento vertical.

## Como rodar localmente

Requisitos: Node.js 20+ e PostgreSQL disponivel.

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Sirva a pasta `frontend` por um servidor estatico e configure a URL da API em `frontend/src/js/config.js`.

## Variaveis de ambiente

Crie `backend/.env`:

```dotenv
DATABASE_URL="postgresql://usuario:senha@localhost:5432/smart_resume_matcher"
JWT_SECRET="uma-chave-segura-com-pelo-menos-32-caracteres"
CORS_ORIGIN="http://localhost:5500"
PORT=3000
NODE_ENV=development
# REDIS_URL="redis://localhost:6379"
```

`REDIS_URL` e opcional; sem Redis o rate limiter utiliza armazenamento em memoria.

## Testes

```bash
cd backend
npm test
```

A suite cobre normalizacao, classificacao, matching sem invencao de skills, ranking/limites de projetos e bullets, compilacao compacta, layout, status/versionamento e sessao autenticada.

## Roadmap

- MVP 1: Perfil Global, subperfis vinculados, projetos/bullets, matching deterministico, PDF compacto e historico aplicado/versionado.
- MVP 2: controles completos de peso/visibilidade por item no editor comparativo de subperfis e aprimoramento de visualizacao do historico.
- Futuro: exportacao para Google Docs usando a camada `GoogleDocsExport`, com OAuth implementado separadamente.

## Decisoes tecnicas

O MVP nao usa IA generativa porque o curriculo precisa ser rastreavel aos dados informados pelo candidato. Matching deterministico oferece testes reprodutiveis, score justificavel, baixo custo operacional e elimina o risco de apresentar uma competencia inexistente.
