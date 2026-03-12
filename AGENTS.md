# Codex Rules For This Repo

## Env Sync Rule (Mandatory)
- If you add, remove, or rename backend env vars in any of:
  - `apps/backend/src/config/env.validation.ts`
  - `apps/backend/src/config/configuration.ts`
  - `apps/backend/.env.example`
- You must also update:
  - `infra/railway/scripts/configure_vars.sh`
  - `.env.railway.setup.sh`

## Validation Before Finishing
- Run:
  - `bash -n infra/railway/scripts/configure_vars.sh`
  - `bash -n .env.railway.setup.sh`
- Confirm `npm run railway:setup` still works from repo root.

## Defaults Policy
- Keep expensive provider features disabled by default unless explicitly requested.
- Require explicit API keys only when the corresponding feature flag is enabled.
