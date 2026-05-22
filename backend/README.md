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
- `CORS_ORIGIN`: origens permitidas, separadas por virgula.

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
- `POST /match` com Bearer token
- `GET /optimized-resumes` com Bearer token
- `DELETE /optimized-resumes/:id` com Bearer token
- `GET /resume-files` com Bearer token
- `POST /resume-files` com Bearer token e `multipart/form-data` no campo `resume`
- `GET /resume-files/:id/download` com Bearer token
- `DELETE /resume-files/:id` com Bearer token
