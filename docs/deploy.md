# Deploy

## Backend on Render

Recommended build command:

```bash
npm ci && npx prisma generate && npx prisma migrate deploy
```

Recommended start command:

```bash
npm start
```

Required environment variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`
- `CORS_ORIGIN`
- `REDIS_URL`
- `ASAAS_ENV`
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `ASAAS_SUCCESS_URL`
- `ASAAS_FAILURE_URL`
- `RESEND_API_KEY`
- `EMAIL_FROM`

Recommended production-only variable:

- `METRICS_TOKEN`

Health checks:

- `GET /health`
- `GET /ready`

Metrics:

- `GET /metrics` with `x-metrics-token` when `METRICS_TOKEN` is set.

## Frontend on Vercel

Root directory:

```text
frontend
```

Build:

```bash
npm ci && npm run build:css
```

The frontend calls `/api`, proxied to the Render backend by `vercel.json`.

## Database

Use managed PostgreSQL. Before production deploy:

```bash
cd backend
npx prisma validate
npx prisma migrate status
npx prisma migrate deploy
```

## Redis

Use managed Redis with TLS when available. Redis supports:

- session/rate-limit helpers;
- cache for repeated reads;
- lower backend load on profile/history screens.

## CI/CD

The GitHub Actions workflow validates:

- backend JavaScript syntax;
- Prisma schema;
- Prisma client generation;
- migrations against PostgreSQL service;
- Jest suite;
- frontend file presence;
- frontend JavaScript syntax;
- Tailwind build.

## Rollback

For MVP scale, prefer simple rollback:

1. redeploy last known good backend commit;
2. redeploy last known good frontend commit;
3. do not roll back database migrations unless a migration-specific rollback script exists;
4. disable paid feature release by switching affected subscriptions to non-active status if billing incident occurs.
