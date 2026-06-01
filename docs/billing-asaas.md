# Billing And Asaas

## Rule

Paid features are released only by the effective plan calculated in `subscription.service.js`.

The effective plan must consider:

- plan;
- status;
- `currentPeriodEnd`, when present.

Pending, cancelled or expired subscriptions must not release paid limits.

## Plans

| Plan | Matching analyses | Subprofiles | Shared jobs |
| --- | ---: | ---: | --- |
| free | 3 lifetime | 0 | no |
| basic | 30 monthly | 2 | yes |
| pro | 100 monthly | 5 | yes |
| premium | 500 monthly | 10 | yes |

## Asaas flow

1. Authenticated user updates billing customer data.
2. Backend creates checkout/payment with Asaas.
3. Local subscription remains pending until payment confirmation.
4. Asaas webhook validates `ASAAS_WEBHOOK_TOKEN`.
5. Webhook updates local subscription status and period.
6. Feature gates read the local effective plan.

## Required webhook properties

Webhook processing must be:

- authenticated;
- idempotent;
- status-aware;
- safe against duplicated events;
- safe against out-of-order events.

## Payment states

Treat these states explicitly in service tests:

- pending or waiting payment: do not release paid plan;
- received/confirmed: release plan when period is valid;
- overdue/expired: remove paid access;
- cancelled: remove paid access;
- refunded/chargeback: remove paid access and log for manual review.

## Operational checks

```bash
cd backend
npm test -- billing.service.test.js billing.controller.test.js asaas.service.test.js subscription.service.test.js
npx prisma validate
npx prisma generate
```

Never expose `ASAAS_API_KEY` or customer CPF/CNPJ in frontend code, browser storage or logs.
