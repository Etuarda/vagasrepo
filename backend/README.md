# Vagas.io - Backend (Node.js + Express + Prisma + Zod + JWT)

## Requisitos

- Node.js 18+
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
7. Crie um Redis gerenciado e configure `REDIS_URL` no Render; sem essa variavel a API funciona, mas as consultas voltam a acessar o Neon a cada carregamento.

## Endpoints

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` com Bearer token
- `GET /jobs` com Bearer token; filtros: `q`, `status`, `period`, `dateFrom`, `dateTo`
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

Com `REDIS_URL` configurado, leituras repetidas de perfis e catalogo global, historico de matching, acompanhamento de vagas, arquivos PDF e vagas compartilhadas usam cache com expiracao e invalidacao automatica apos alteracoes.
