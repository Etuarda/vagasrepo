# Vagas.io — Fullstack (Frontend + Backend)

Este ZIP contém:
- `/backend`: API Node.js (Express + Prisma + Zod + JWT)
- `/frontend`: UI estática (HTML + JS) já integrada à API

## Como rodar (local)

### 1) Backend
```bash
cd backend
cp .env.example .env
# edite DATABASE_URL, JWT_SECRET e CORS_ORIGIN
npm install
npx prisma migrate dev --name init
npx prisma generate
npm run dev
```

### 2) Frontend
Em outro terminal:
```bash
cd frontend
python -m http.server 5500
```
Acesse: `http://localhost:5500`

**Obs:** Se sua API não estiver em `http://localhost:3000`, edite:
- `frontend/src/js/config.js`
