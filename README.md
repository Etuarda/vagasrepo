# Vagas.io

Aplicacao para gerenciar candidaturas, com frontend estatico e API Node.js/Express usando Prisma.

## Deploy recomendado

- Frontend: Vercel, usando a pasta `frontend` como root directory.
- Backend/API: Render ou outro provedor Node.js.
- Banco de dados: Neon Postgres.

## Ordem de configuracao

1. Crie o banco no Neon e copie a connection string Postgres com `sslmode=require`.
2. Configure as variaveis do backend: `DATABASE_URL`, `JWT_SECRET` e `CORS_ORIGIN`.
3. Rode migrations no deploy do backend com `npm run prisma:deploy`.
4. Publique o frontend na Vercel apontando para a pasta `frontend`.
5. Atualize `frontend/src/js/config.js` com a URL publica da API.
6. Atualize `CORS_ORIGIN` no backend com a URL final da Vercel.
