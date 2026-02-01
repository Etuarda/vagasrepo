# Vagas.io — Backend (Node.js + Express + Prisma + Zod + JWT)

## Requisitos
- Node.js 18+
- Postgres local (ou remoto)

## Setup
1) Instale dependências:
```bash
npm install
```

2) Crie `.env` a partir do `.env.example` e preencha:
- `DATABASE_URL`
- `JWT_SECRET` (>= 32 chars)

3) Rode migrations e gere o client:
```bash
npx prisma migrate dev --name init
npx prisma generate
```

4) Suba a API:
```bash
npm run dev
```

API: `http://localhost:3000`

## Endpoints
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me` (Bearer)
- `GET /jobs` (Bearer) — filtros: `q`, `status`, `fase`
- `POST /jobs` (Bearer)
- `PUT /jobs/:id` (Bearer)
- `DELETE /jobs/:id` (Bearer)
