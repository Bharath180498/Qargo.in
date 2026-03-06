# Follow-Me Deploy Guide (Railway)

This is the simple version for this repo.

## 1. One-Time Setup

1. Install CLI and login:
   ```bash
   npm i -g @railway/cli
   railway login
   ```

2. In Railway dashboard, create one project with services:
   - `backend`
   - `Postgres`
   - `Redis`
   - `admin` (optional for now)

3. Backend service settings:
   - Keep source root at repo root
   - Config-as-Code path: `/apps/backend/railway.json`
   - If Railway still uses Railpack, set:
     - Build Command: `npm run build:backend`
     - Start Command: `npm run start:backend:migrate`

4. Admin service settings (if using admin):
   - Config-as-Code path: `/apps/admin/railway.json`

5. Link local folder to Railway project:
   ```bash
   cd /Users/bharath/Desktop/Porter
   railway link --project <YOUR_PROJECT_ID>
   ```

6. Set service variables:
   - If your service names are exactly `backend`, `Postgres`, `Redis`:
     ```bash
     npm run railway:configure-vars -- --skip-admin
     ```
   - If names are different:
     ```bash
     npm run railway:configure-vars -- \
       --backend-service <backend-name> \
       --postgres-service <postgres-name> \
       --redis-service <redis-name> \
       --skip-admin
     ```

## 2. First Backend Deploy

Option A: Deploy local code immediately
```bash
railway up --service backend --detach
```

Option B: Deploy from GitHub commit
```bash
git add .
git commit -m "deploy prep"
git push origin main
```
Then redeploy from Railway dashboard.

## 3. Get Backend Domain

In Railway dashboard:
- backend service -> Settings -> Networking -> Public Networking -> Generate Domain

Use this URL in mobile app:
- `apps/mobile/app.json` -> `expo.extra.apiBaseUrl`
- Example:
  ```json
  "apiBaseUrl": "https://your-backend.up.railway.app/api"
  ```

Restart Expo after editing:
```bash
npm run dev:mobile:fresh
```

## 4. Every Time You Make Changes

### Backend changes
1. Push code:
   ```bash
   git add .
   git commit -m "backend updates"
   git push origin main
   ```
2. Deploy backend:
   - Auto-deploy (if enabled), or
   - `railway up --service backend --detach`

### Admin changes
1. Push code
2. Deploy:
   ```bash
   railway up --service admin --detach
   ```

### Mobile-only changes
- No Railway deploy needed.
- Just restart Expo:
  ```bash
  npm run dev:mobile:fresh
  ```

## 5. Health Checks

Backend:
```bash
curl https://<backend-domain>/api/health
```

If mobile says API unreachable:
- confirm `app.json` has correct `https://.../api`
- restart Expo (`npm run dev:mobile:fresh`)
- ensure backend health URL works in phone browser

## 6. Common Errors and Fixes

`Service 'backend' not found`
- Your service name is different.
- Run:
  ```bash
  railway service status --all
  ```
- Re-run vars script with real names.

`No start command was found` (Railpack)
- backend service is not using correct config/commands.
- Set:
  - Build Command: `npm run build:backend`
  - Start Command: `npm run start:backend:migrate`

`Missing script: build:backend`
- Railway is building old code from GitHub.
- Push latest code first, then redeploy.
