#!/usr/bin/env bash
set -euo pipefail

BACKEND_SERVICE="backend"
ADMIN_SERVICE="admin"

usage() {
  cat <<'EOF'
Deploy backend and admin services to Railway from this repository.

Usage:
  ./infra/railway/scripts/deploy_all.sh [--backend-service backend] [--admin-service admin]

Before running:
  1) railway login
  2) railway link
  3) Set each service's config file path in Railway UI:
     backend -> /apps/backend/railway.json
     admin   -> /apps/admin/railway.json
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --backend-service)
      BACKEND_SERVICE="$2"
      shift 2
      ;;
    --admin-service)
      ADMIN_SERVICE="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

require_cmd railway

if ! railway status >/dev/null 2>&1; then
  echo "Railway project is not linked. Run: railway link" >&2
  exit 1
fi

echo "Deploying backend service: $BACKEND_SERVICE"
railway up --service "$BACKEND_SERVICE" --detach

echo "Deploying admin service: $ADMIN_SERVICE"
railway up --service "$ADMIN_SERVICE" --detach

echo "Deployments triggered."
