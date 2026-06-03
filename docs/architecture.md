# Architecture

## Scope

The system is a SaaS for job applications, professional profiles, deterministic ATS matching, optimized resumes, shared jobs and subscription billing.

## Backend layers

- `routes`: HTTP wiring and middleware composition.
- `controllers`: request/response orchestration.
- `schemas`: Zod validation contracts.
- `services`: business rules, Prisma access and integrations.
- `modules`: pure or near-pure domain logic, especially matching and resume compilation.
- `middlewares`: authentication, security headers, rate limit, request context and error handling.

Controllers should not implement billing, matching, profile ownership or persistence rules directly. Those rules belong in services/modules so they can be tested without an HTTP server.

## Frontend layers

- `http.js`: API client with `credentials: "include"` for HttpOnly session cookies.
- `state.js`: in-memory UI state only. It must not store JWTs or sensitive user data.
- `auth.js`: login/logout/session bootstrap.
- `career.js`: profile, matching, applications and resume screen orchestration.
- `match-display.utils.js`: display normalization for score, incomplete analysis and warnings.
- `ui.js`: navigation, modals, notifications and reusable rendering helpers.

## Domain boundaries

- Profile ownership is enforced in backend services with `userId`.
- Subprofile limits are enforced by `subscription.service.js`.
- Matching calculations are centralized in `modules/matching/job-match-evaluator.service.js`.
- Shared jobs expose public job metadata only. They do not calculate or expose ATS scores.
- Billing state is synchronized locally only through validated Asaas flows/webhooks.

## MVP decisions

- No generative AI.
- No microservices.
- No Kubernetes.
- PostgreSQL stores the current data model; object storage for PDFs is a future scaling step.
- Redis is operationally useful but the API can degrade to local cache/session behavior where implemented.

## Growth risks to monitor

- Large PDFs in PostgreSQL can pressure backups and query performance.
- More matching dimensions should be added through the evaluator contract, not new divergent scoring rules.
- Billing must stay idempotent and webhook-driven to avoid releasing paid features incorrectly.
