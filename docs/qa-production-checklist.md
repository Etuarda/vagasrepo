# QA And Production Checklist

Run this checklist before promoting a release.

## Backend commands

```bash
cd backend
npm install
npx prisma validate
npx prisma generate
npx prisma migrate status
npx prisma migrate deploy
npm test
```

## Frontend commands

```bash
cd frontend
npm install
npm run build:css
```

## Manual smoke tests

- Register account.
- Login and confirm `/auth/me` works through HttpOnly cookie.
- Logout and confirm session is revoked.
- Complete global profile.
- Create subprofile inside plan limit.
- Try creating subprofile above plan limit.
- Generate ATS matching with complete profile.
- Confirm incomplete profiles do not show `0%`.
- Recalculate analysis with another profile and confirm a new version is created.
- Download optimized resume.
- Upload, view and download reference PDF.
- Create application from matching.
- Change application phase and confirm history is recorded.
- Mark application as ended and confirm general status is ended.
- List shared jobs and confirm full job description is not exposed.
- Run billing checkout in Asaas sandbox.
- Send valid and invalid Asaas webhook events.
- Confirm pending/cancelled/expired plans do not release paid limits.

## Security checks

- Browser storage must not contain JWT or password.
- Cookies must be HttpOnly and Secure in production.
- API must reject cross-user profile/subprofile access.
- Rate limit must apply to auth and heavy endpoints.
- Logs must not expose email, CPF/CNPJ, password, token or full Authorization header.
- `/metrics` should require `METRICS_TOKEN` in production.

## Release evidence

Attach to the release notes:

- commit hash;
- migration status output;
- test output summary;
- frontend build output;
- Render deploy URL;
- Vercel deploy URL;
- Asaas sandbox webhook result.
