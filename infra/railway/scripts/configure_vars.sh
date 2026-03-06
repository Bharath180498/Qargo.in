#!/usr/bin/env bash
set -euo pipefail

BACKEND_SERVICE="backend"
ADMIN_SERVICE="admin"
POSTGRES_SERVICE="Postgres"
REDIS_SERVICE="Redis"
JWT_SECRET_INPUT="${JWT_SECRET:-}"
SKIP_ADMIN="false"

usage() {
  cat <<'EOF'
Configure Railway service variables for this monorepo.

Usage:
  ./infra/railway/scripts/configure_vars.sh \
    [--backend-service backend] \
    [--admin-service admin] \
    [--postgres-service Postgres] \
    [--redis-service Redis] \
    [--skip-admin] \
    [--jwt-secret your-secret]

Notes:
  - Run after creating all Railway services.
  - This script uses Railway service references:
    DATABASE_URL=${{Postgres.DATABASE_URL}}
    REDIS_URL=${{Redis.REDIS_URL}}
    NEXT_PUBLIC_API_URL=https://${{backend.RAILWAY_PUBLIC_DOMAIN}}/api
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

generate_secret() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
  else
    date +%s | shasum | awk '{print $1}'
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
    --postgres-service)
      POSTGRES_SERVICE="$2"
      shift 2
      ;;
    --redis-service)
      REDIS_SERVICE="$2"
      shift 2
      ;;
    --jwt-secret)
      JWT_SECRET_INPUT="$2"
      shift 2
      ;;
    --skip-admin)
      SKIP_ADMIN="true"
      shift
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

if [[ -z "$JWT_SECRET_INPUT" ]]; then
  JWT_SECRET_INPUT="$(generate_secret)"
  echo "Generated JWT secret."
fi

set_var() {
  local service="$1"
  local assignment="$2"

  if ! railway variable set "$assignment" --service "$service" --skip-deploys >/dev/null; then
    echo
    echo "Failed to set variable on service '$service'." >&2
    echo "Check available services with:" >&2
    echo "  railway service status --all" >&2
    echo "Then rerun with explicit names, e.g.:" >&2
    echo "  npm run railway:configure-vars -- --backend-service <name> --postgres-service <name> --redis-service <name>" >&2
    exit 1
  fi
}

db_ref="\${{${POSTGRES_SERVICE}.DATABASE_URL}}"
redis_ref="\${{${REDIS_SERVICE}.REDIS_URL}}"
api_ref="https://\${{${BACKEND_SERVICE}.RAILWAY_PUBLIC_DOMAIN}}/api"

echo "Setting backend variables on service: $BACKEND_SERVICE"
set_var "$BACKEND_SERVICE" "DATABASE_URL=$db_ref"
set_var "$BACKEND_SERVICE" "REDIS_URL=$redis_ref"
set_var "$BACKEND_SERVICE" "JWT_SECRET=$JWT_SECRET_INPUT"
set_var "$BACKEND_SERVICE" "JWT_EXPIRES_IN=7d"
set_var "$BACKEND_SERVICE" "NODE_ENV=production"
set_var "$BACKEND_SERVICE" "AUTH_MODE=otp"
set_var "$BACKEND_SERVICE" "ROUTE_PROVIDER=mock"
set_var "$BACKEND_SERVICE" "KYC_PROVIDER=mock"
set_var "$BACKEND_SERVICE" "PUSH_PROVIDER=mock"
set_var "$BACKEND_SERVICE" "OTP_TTL_SECONDS=300"
set_var "$BACKEND_SERVICE" "OTP_FIXED_CODE=123456"
set_var "$BACKEND_SERVICE" "DISPATCH_RADIUS_KM=8"
set_var "$BACKEND_SERVICE" "WAITING_RATE_PER_MINUTE=3"
set_var "$BACKEND_SERVICE" "BASE_FARE_PER_KM=14"
set_var "$BACKEND_SERVICE" "GOOGLE_MAPS_API_KEY=replace-me"
set_var "$BACKEND_SERVICE" "IDFY_API_KEY=replace-me"
set_var "$BACKEND_SERVICE" "FCM_SERVER_KEY=replace-me"
set_var "$BACKEND_SERVICE" "S3_ENDPOINT=replace-me"
set_var "$BACKEND_SERVICE" "S3_REGION=ap-south-1"
set_var "$BACKEND_SERVICE" "S3_BUCKET=replace-me"
set_var "$BACKEND_SERVICE" "S3_ACCESS_KEY_ID=replace-me"
set_var "$BACKEND_SERVICE" "S3_SECRET_ACCESS_KEY=replace-me"
set_var "$BACKEND_SERVICE" "RAZORPAY_KEY_ID=replace-me"
set_var "$BACKEND_SERVICE" "RAZORPAY_KEY_SECRET=replace-me"
set_var "$BACKEND_SERVICE" "STRIPE_SECRET_KEY=replace-me"
set_var "$BACKEND_SERVICE" "GSTN_API_URL=https://sandbox.gstn.example"
set_var "$BACKEND_SERVICE" "EWAY_BILL_API_URL=https://sandbox.ewaybill.example"

if [[ "$SKIP_ADMIN" == "false" ]]; then
  echo "Setting admin variables on service: $ADMIN_SERVICE"
  set_var "$ADMIN_SERVICE" "NODE_ENV=production"
  set_var "$ADMIN_SERVICE" "NEXT_TELEMETRY_DISABLED=1"
  set_var "$ADMIN_SERVICE" "NEXT_PUBLIC_API_URL=$api_ref"
fi

echo
echo "Variables configured."
echo "Review in Railway UI, then deploy:"
echo "  railway up --service \"$BACKEND_SERVICE\" --detach"
if [[ "$SKIP_ADMIN" == "false" ]]; then
  echo "  railway up --service \"$ADMIN_SERVICE\" --detach"
fi
