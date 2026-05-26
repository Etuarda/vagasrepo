# Vagas.io - Backend (Node.js + Express + Prisma + Zod + JWT)

## Requisitos

- Node.js 20+
- Postgres local ou Neon

## Setup local

1. Instale dependencias:

```bash
npm install
```

2. Crie `.env` a partir de `.env.example` e preencha:

- `DATABASE_URL`: connection string Postgres do Neon com `sslmode=require`.
- `JWT_SECRET`: chave com pelo menos 32 caracteres.
- `CORS_ORIGIN`: origens adicionais permitidas, separadas por virgula. A API ja autoriza `https://gestaodevagas.vercel.app` e previews `https://gestaodevagas-*-eduardas-projects-9a8623c8.vercel.app`.
- `REDIS_URL`: conexao Redis TLS (`rediss://...`) usada para sessoes, rate limiting e cache das telas de perfil, historico e candidaturas.
- `FRONTEND_URL`: URL publica da Vercel usada no link de recuperacao de senha.
- `RESEND_API_KEY`: chave da API Resend usada para enviar a recuperacao de senha.
- `EMAIL_FROM`: remetente verificado no Resend, por exemplo `Vagas.io <recuperacao@seudominio.com>`. Para um teste inicial enviado somente ao e-mail da propria conta Resend, use `Vagas.io <onboarding@resend.dev>`.
- `SLOW_QUERY_MS`: limiar para log estruturado de consultas Prisma lentas; padrao `500`.

3. Rode migrations e gere o client:

```bash
npx prisma migrate dev --name init
npx prisma generate
```

4. Suba a API:

```bash
npm run dev
```

API: `http://localhost:3000`

## Deploy com Neon

1. Crie um projeto no Neon.
2. Copie a connection string Postgres para `DATABASE_URL`.
3. Configure as mesmas variaveis no provedor da API.
4. Use `npm install && npm run prisma:deploy` como build command.
5. Use `npm start` como start command.
6. Configure `CORS_ORIGIN` no Render somente para dominios adicionais ou preview local que precise acessar a API publicada.
7. Crie um Redis gerenciado e configure `REDIS_URL` no Render; sem essa variavel a API usa somente cache local por instancia, sem compartilhar resultados entre replicas ou reinicios.
8. Configure `FRONTEND_URL`, `RESEND_API_KEY` e `EMAIL_FROM` no Render para habilitar o envio de links de recuperacao.

O frontend publicado encaminha `/api/*` para a Render. Assim, o navegador recebe a sessao em cookie `HttpOnly`, sem armazenar JWT em `localStorage`. O backend ainda aceita Bearer token durante a transicao de clientes antigos.

O envio de recuperacao usa o SDK oficial `resend`. O dominio de teste `resend.dev` nao atende usuarios finais: para producao, valide um dominio no Resend e configure `EMAIL_FROM` com esse dominio.

Consultas Prisma acima de `SLOW_QUERY_MS` geram evento estruturado `slow_query` nos logs da Render. Encaminhe esses logs e `/metrics` para sua ferramenta de monitoramento para alertas e historico operacional.

## Endpoints

- `GET /health`
- `GET /ready`; verifica conexao com o banco e informa se o cache esta em `redis_ready`, `local_only` ou `degraded_local`.
- `GET /metrics`; metricas HTTP basicas em formato Prometheus.
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/forgot-password`
- `POST /auth/reset-password`
- `GET /auth/me` com Bearer token
- `GET /jobs` autenticado; filtros: `q`, `status`, `period`, `dateFrom`, `dateTo`, `cursor`, `limit`. Use `cursor` com o ultimo `id` retornado para listas extensas.
- `POST /jobs` com Bearer token
- `PUT /jobs/:id` com Bearer token
- `DELETE /jobs/:id` com Bearer token
- `GET /profile` com Bearer token
- `GET /profiles` com Bearer token
- `POST /profiles` com Bearer token
- `PUT /profile` com Bearer token
- `PUT /profile/skills` com Bearer token
- `POST /profile/projects` com Bearer token
- `DELETE /profile/projects/:id` com Bearer token
- `POST /profile/experiences` com Bearer token
- `DELETE /profile/experiences/:id` com Bearer token
- `POST /profile/courses` com Bearer token
- `DELETE /profile/courses/:id` com Bearer token
- `POST /profile/certifications` com Bearer token
- `DELETE /profile/certifications/:id` com Bearer token
- `POST /match` com Bearer token
- `GET /shared-matched-jobs?period=day|week|month` com Bearer token; retorna cargo, empresa e link das vagas pesquisadas no matching ou cadastradas em acompanhamento, sem identificar usuarios
- `GET /optimized-resumes` com Bearer token
- `DELETE /optimized-resumes/:id` com Bearer token
- `GET /resume-files` com Bearer token
- `POST /resume-files` com Bearer token e `multipart/form-data` no campo `resume`
- `GET /resume-files/:id/download` com Bearer token
- `DELETE /resume-files/:id` com Bearer token

O historico de matching (`JobAnalysis` e PDFs otimizados associados) fica disponivel por 30 dias. Registros expirados nao sao retornados; a limpeza fisica e iniciada em segundo plano para nao atrasar a tela. Candidaturas ja registradas permanecem salvas.

Leituras repetidas de perfis e catalogo global, historico de matching, acompanhamento de vagas, arquivos PDF e vagas compartilhadas usam cache local com expiracao e invalidacao automatica apos alteracoes. Com `REDIS_URL` configurado, esse cache tambem e compartilhado entre instancias da API.

O frontend pre-carrega perfis, subperfis, historicos e referencias de curriculo em segundo plano apos o acesso. O historico continua persistido no banco por 30 dias; a pre-carga e o cache apenas evitam novas esperas ao navegar, sendo invalidados apos alteracoes.

Uploads PDF sao limitados a 3 MB e validados por extensao, MIME e assinatura/trailer do arquivo antes da persistencia. Para escala acima do volume atual, arquivos e PDFs gerados devem migrar do PostgreSQL para object storage e geracao assíncrona em fila.
