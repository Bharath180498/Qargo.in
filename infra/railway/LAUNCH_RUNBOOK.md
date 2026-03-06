# Railway Launch Runbook

## 1. Prerequisites

- Railway account and project created
- Repo connected to Railway project
- Domain ready for admin/backend (optional but recommended)
- Local tools:
  - `railway` CLI
  - `npm`

Install CLI if needed:

```bash
npm i -g @railway/cli
```

## 2. Create Services

Inside one Railway project, create:

1. `backend` (GitHub repo service)
2. `admin` (GitHub repo service)
3. `Postgres` (template)
4. `Redis` (template)

Recommended service names are exactly: `backend`, `admin`, `Postgres`, `Redis`.

## 3. Configure Build/Deploy Config Paths

Set in Railway UI:

- backend service config path: `/apps/backend/railway.json`
- admin service config path: `/apps/admin/railway.json`
- source root directory: keep default repo root (do not set to `apps/backend` or `apps/admin`)

These files configure Dockerfile builds, watch patterns, healthchecks, and backend Prisma migration as pre-deploy step.

If Railway still uses Railpack (log shows `Railpack` and `No start command was found`), set these in backend service settings:

- Build command: `npm run build:backend`
- Start command: `npm run start:backend`
- Pre-deploy command: `npm run migrate:backend`

## 4. Link Project Locally

```bash
railway login
railway link
```

## 5. Set Variables

Run:

```bash
./infra/railway/scripts/configure_vars.sh
```

If your service names differ:

```bash
./infra/railway/scripts/configure_vars.sh \
  --backend-service <backend-name> \
  --admin-service <admin-name> \
  --postgres-service <postgres-name> \
  --redis-service <redis-name>
```

## 6. Deploy

```bash
./infra/railway/scripts/deploy_all.sh
```

## 7. Verify

1. Backend health:
   - `https://<backend-domain>/api/health`
2. Admin UI:
   - `https://<admin-domain>`
3. End-to-end:
   - create order estimate in mobile app
   - create order
   - check driver assignment + live tracking

## 8. Mobile Production API URL

Update:

- `apps/mobile/app.json` -> `expo.extra.apiBaseUrl`

Set to:

- `https://<backend-domain>/api`

Then rebuild/reload app.

## 9. Day-2 Checklist

- Add custom domains for both services
- Add real provider keys (Razorpay/Stripe/FCM/GSTN/EWay Bill)
- Configure Railway metrics/alerts
- Enable backup strategy for Postgres
- Test rollback by redeploying previous healthy deployment
