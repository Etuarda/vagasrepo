# Smart Resume Matcher

## Visao geral

Smart Resume Matcher e uma aplicacao SaaS para manter uma base profissional confiavel e compilar curriculos direcionados a vagas. O candidato cadastra seus dados reais uma vez, organiza estrategias por subperfil e recebe um curriculo compacto baseado em aderencia verificavel.

O produto nao utiliza IA generativa, LLM ou servicos externos de geracao textual. Ele seleciona, ordena e formata informacoes previamente cadastradas.

## Funcionalidades

- Perfil Global com contato, resumo, formacao, experiencias editaveis, skills, projetos, cursos, certificacoes e idiomas.
- Subperfis como Backend, Dados ou Fullstack, com heranca por vinculo dos itens globais.
- Projetos estruturados com titulo, categoria/area, resumo curto, stack textual e links de repositorio/deploy.
- Carga horaria em experiencias, cursos e certificacoes, preservada no curriculo gerado.
- Upload de PDF somente como anexo de referencia, com visualizacao, download e remocao.
- Analise deterministica de descricao de vaga com keywords normalizadas e categoria profissional.
- Ranking explicavel de skills e projetos.
- Curriculo PDF ATS-friendly, legivel, com no maximo dois projetos selecionados por vaga.
- Historico de analises editavel e versionado, com estados `draft`, `reviewed`, `applied`, `archived` e `rejected`.
- Registro opcional de candidatura a partir do curriculo gerado, vinculado a analise e ao curriculo otimizado.
- Registro da data de aplicacao ao marcar um curriculo como aplicado.
- Mural autenticado de vagas compartilhadas, reunindo matchings e acompanhamentos e exibindo somente cargo, empresa e link com filtros de ultimo dia, semana ou mes.
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

`profile.service.js` mantem compatibilidade com os endpoints atuais. Subperfis vinculam seletivamente skills, projetos, experiencias, formacoes, cursos, certificacoes e idiomas globais por tabelas `Subprofile*`, evitando copias desnecessarias. Dados pessoais e resumo podem ser copiados do Perfil Global para o subperfil pelo editor. `matching.service.js` coordena persistencia e chama os modulos puros testaveis.

## Modelo de dados

- `CareerProfile`: representa o Perfil Global (`isGlobal`) e os subperfis.
- `Skill`, `Education`, `Experience`, `Course`, `Certification` e `Language`: base factual do candidato.
- `Project`, `ProjectTechnology` e `ProjectBullet`: portifolio estruturado e evidencias selecionaveis.
- `SubprofileSkill`, `SubprofileProject`, `SubprofileExperience`, `SubprofileEducation`, `SubprofileCourse`, `SubprofileCertification` e `SubprofileLanguage`: selecao e visibilidade por estrategia.
- `JobAnalysis`: descricao, categoria, score, selecoes, status e encadeamento de versoes.
- `SharedMatchedJob`: cargo, empresa, link e data de vagas pesquisadas; o mural tambem agrega as vagas cadastradas em `Job`, sem expor o usuario.
- `OptimizedResume`: snapshot da selecao e arquivo PDF gerado.
- `Job`: candidatura acompanhada no painel; quando originada pelo matching, referencia `JobAnalysis` e `OptimizedResume`.
- `GoogleDocsExport`: metadados reservados para exportacao futura.

Dados legados de subperfis clonados continuam legiveis. Novos subperfis usam vinculacao ao Perfil Global.

## Persistencia e seguranca

Dados de negocio sao persistidos no PostgreSQL via Prisma. Perfil, subperfis, itens estruturados, PDFs de referencia, analises, curriculos otimizados e candidaturas sao lidos e alterados por endpoints autenticados; o estado do frontend existe apenas para renderizar a resposta atual da API.

O navegador mantem somente o token Bearer do MVP e a preferencia visual de contraste em `localStorage`. Selecoes de perfil, historico de matching e arquivos PDF nao sao armazenados localmente. O token possui expiracao, a sessao e registrada em `AuthSession` e o logout revoga a sessao no backend.

As rotas de perfil, matching, curriculos, anexos e candidaturas exigem JWT ativo. Os servicos aplicam `userId` nas consultas de leitura e alteracao, evitando acesso entre usuarios.

## Curriculo PDF de referencia

O PDF anexado e armazenado somente como arquivo de referencia para visualizacao ou download. O MVP nao extrai texto, nao cria rascunhos e nao altera Perfil Global ou Subperfis a partir do documento.

O curriculo otimizado consome exclusivamente informacoes preenchidas manualmente nos formularios estruturados. Antes da geracao, o sistema exige dados pessoais com contato, resumo, habilidades, formacao ou experiencia, pelo menos um projeto estruturado e nivel para todo idioma cadastrado.

## Matching

A descricao da vaga e normalizada por dicionario tecnico, por exemplo: `Node.js` vira `nodejs`, `Postgres` vira `postgresql` e `APIs REST` vira `api-rest`. O motor classifica a vaga em `backend`, `frontend`, `fullstack`, `data`, `ai`, `devops`, `qa`, `product` ou `unknown`.

A formula do score final no modo otimizado por vaga e:

```text
60% skills compativeis
40% projetos compativeis
```

O matching altera apenas a selecao e a ordenacao de habilidades e projetos. Resumo, formacao, experiencias, cursos, certificacoes e idiomas sao exibidos conforme alocados no perfil selecionado, sem ranking, reescrita ou truncamento. Habilidades tecnicas especificas sao selecionadas pela vaga; competencias transversais previamente cadastradas, como Git, GitHub, Scrum, Kanban, metodologias ageis e versionamento de codigo, permanecem no curriculo independentemente da area. Para projetos, a aderencia usa titulo, categoria/area, resumo curto e stack textual cadastrados; a stack serve somente como parametro de matching e nao e impressa no curriculo otimizado. Dados legados ocultos nao alimentam o calculo. O resultado separa `matchedSkills` de `missingSkills`, limita o curriculo otimizado a dois projetos e informa a justificativa do ranking.

O formulario de analise salva cargo, empresa, link e descricao da vaga em `JobAnalysis`. A analise e o curriculo otimizado permanecem acessiveis no historico por 30 dias; registros vencidos deixam de ser exibidos imediatamente e sua limpeza e disparada em segundo plano. Uma candidatura persistida permanece independente desse prazo; quando disponivel, o link salvo e preenchido automaticamente no cadastro de acompanhamento.

Na tela de matching, o usuario pode selecionar um perfil especifico ou deixar o motor sugerir o perfil mais aderente. Em ambos os casos, anexos PDF permanecem apenas para leitura e visualizacao.

Cargo, empresa e link da vaga sao obrigatorios para gerar um matching. A cada geracao, esses tres campos sao registrados em `SharedMatchedJob`. A aba Vagas compartilhadas tambem lista vagas cadastradas para acompanhamento e fica visivel para qualquer usuario autenticado. Descricao da vaga, perfil selecionado, score e dados do candidato nao sao compartilhados.

## Registro de candidatura

Depois de gerar um curriculo otimizado, a interface oferece registrar a vaga em Candidaturas. O endpoint `POST /job-analyses/:id/create-application` recebe somente links, fase, acao, feedback e observacoes; titulo, empresa, descricao original, score, subperfil, skills e projetos permanecem derivados da analise vinculada.

A candidatura nasce com status `Ativa` e fase `Curriculo gerado`, salvo se o usuario escolher outra fase no formulario. Gerar curriculo nao marca a vaga como aplicada. Se a fase `Aplicada` for escolhida explicitamente, a data de aplicacao e registrada. Uma segunda candidatura para a mesma analise exige confirmacao explicita.

## Layout do curriculo

O PDF incorpora Arial quando a fonte esta disponivel ou configurada, com nome em 23 pt, secoes em 13 pt azul escuro e corpo em 11 pt. O cabecalho inclui cidade/estado e CEP quando cadastrados. Links de e-mail, GitHub, LinkedIn, Lattes, repositorios, deploys e credenciais sao exibidos integralmente, independentes, azuis e clicaveis.
Em cursos e certificacoes, apenas o nome do item recebe destaque em negrito; instituicao/emissor, periodo e duracao sao exibidos como metadados regulares para preservar hierarquia visual.

A ordem gerada e: cabecalho, resumo, formacao academica, experiencia profissional, projetos, habilidades e competencias, certificacoes/cursos e idiomas. O compilador permite duas paginas para preservar legibilidade; nao reduz fontes abaixo de 10 pt nem corta dados fixos preenchidos pelo usuario.

## Como rodar localmente

Requisitos: Node.js 20+ e PostgreSQL disponivel.

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

Sirva a pasta `frontend` por um servidor estatico. Em ambiente local e na Vercel, ela chama diretamente a API publicada em `https://gerenciadorpessoaldevagas.onrender.com`. O backend autoriza o dominio Vercel deste projeto e seus previews controlados; use `CORS_ORIGIN` para origens adicionais.

## Variaveis de ambiente

Crie `backend/.env`:

```dotenv
DATABASE_URL="postgresql://usuario:senha@localhost:5432/smart_resume_matcher"
JWT_SECRET="uma-chave-segura-com-pelo-menos-32-caracteres"
CORS_ORIGIN="http://localhost:5500"
PORT=3000
NODE_ENV=development
REDIS_URL="rediss://default:senha@host:porta"
# RESUME_FONT_PATH="/caminho/para/arial.ttf"
# RESUME_BOLD_FONT_PATH="/caminho/para/arialbd.ttf"
```

`REDIS_URL` deve ser configurada no Render para acelerar a troca de perfis, Itens do Perfil Global, historico de matching e acompanhamento de vagas; sem Redis essas leituras continuam funcionando, mas consultam o Neon novamente. O Redis tambem e usado para sessao e rate limiting. No Windows, o gerador detecta Arial automaticamente em `C:\Windows\Fonts`. Em outros ambientes, configure `RESUME_FONT_PATH` e `RESUME_BOLD_FONT_PATH` com arquivos Arial licenciados para incorporar a tipografia exigida no PDF; sem eles, o renderer usa a fonte sans-serif PDF padrao como fallback.

## Testes

```bash
cd backend
npm test
```

A suite cobre normalizacao, classificacao, matching sem invencao de skills, ranking/limites de projetos, compilacao compacta, layout, status/versionamento e sessao autenticada.

## Roadmap

- MVP 1: Perfil Global, subperfis vinculados, projetos com cinco campos essenciais, matching deterministico, PDF compacto e historico aplicado/versionado.
- MVP 2: controles completos de peso/visibilidade por item no editor comparativo de subperfis e aprimoramento de visualizacao do historico.
- Futuro: importacao automatica de PDF somente com extracao revisavel e confirmacao manual antes de persistir dados estruturados.
- Futuro: exportacao para Google Docs usando a camada `GoogleDocsExport`, com OAuth implementado separadamente.

## Decisoes tecnicas

O MVP nao usa IA generativa porque o curriculo precisa ser rastreavel aos dados informados pelo candidato. Matching deterministico oferece testes reprodutiveis, score justificavel, baixo custo operacional e elimina o risco de apresentar uma competencia inexistente.
