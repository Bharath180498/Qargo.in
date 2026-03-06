# Railway Deployment

This folder contains Railway deployment setup for the monorepo.

## Services

Create these services in one Railway project:

1. `backend` (from repo)
2. `admin` (from repo)
3. `Postgres` (Railway PostgreSQL template)
4. `Redis` (Railway Redis template)

## Config-As-Code Files

- Backend service config path: `/apps/backend/railway.json`
- Admin service config path: `/apps/admin/railway.json`

Set those paths in each service:

`Service Settings -> Config as Code -> Path`

Keep service source root at repository root so Dockerfile paths like `apps/backend/Dockerfile` and `apps/admin/Dockerfile` resolve correctly.

## Variable Wiring

Use script:

```bash
./infra/railway/scripts/configure_vars.sh
```

This configures service references:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}`
- `REDIS_URL=${{Redis.REDIS_URL}}`
- `NEXT_PUBLIC_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api`

## Deploy

```bash
./infra/railway/scripts/deploy_all.sh
```

Full runbook: [`./LAUNCH_RUNBOOK.md`](./LAUNCH_RUNBOOK.md)
