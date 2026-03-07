#!/usr/bin/env bash
set -euo pipefail

BACKEND_SERVICE="backend"
ADMIN_SERVICE="admin"
POSTGRES_SERVICE="Postgres"
REDIS_SERVICE="Redis"
JWT_SECRET_INPUT="${JWT_SECRET:-}"
GOOGLE_MAPS_API_KEY_INPUT="${GOOGLE_MAPS_API_KEY:-}"
ROUTE_PROVIDER_VALUE="${ROUTE_PROVIDER:-mock}"
KYC_PROVIDER_VALUE="${KYC_PROVIDER:-mock}"
PUSH_PROVIDER_VALUE="${PUSH_PROVIDER:-mock}"
OTP_PROVIDER_VALUE="${OTP_PROVIDER:-mock}"
IDFY_API_KEY_INPUT="${IDFY_API_KEY:-replace-me}"
IDFY_API_URL_INPUT="${IDFY_API_URL:-replace-me}"
IDFY_ACCOUNT_ID_INPUT="${IDFY_ACCOUNT_ID:-replace-me}"
CASHFREE_CLIENT_ID_INPUT="${CASHFREE_CLIENT_ID:-replace-me}"
CASHFREE_CLIENT_SECRET_INPUT="${CASHFREE_CLIENT_SECRET:-replace-me}"
CASHFREE_KYC_API_URL_INPUT="${CASHFREE_KYC_API_URL:-replace-me}"
CASHFREE_API_VERSION_INPUT="${CASHFREE_API_VERSION:-2023-08-01}"
FCM_SERVER_KEY_INPUT="${FCM_SERVER_KEY:-replace-me}"
TWILIO_ACCOUNT_SID_INPUT="${TWILIO_ACCOUNT_SID:-replace-me}"
TWILIO_AUTH_TOKEN_INPUT="${TWILIO_AUTH_TOKEN:-replace-me}"
TWILIO_MESSAGING_SERVICE_SID_INPUT="${TWILIO_MESSAGING_SERVICE_SID:-replace-me}"
TWILIO_FROM_NUMBER_INPUT="${TWILIO_FROM_NUMBER:-replace-me}"
RAZORPAY_KEY_ID_INPUT="${RAZORPAY_KEY_ID:-replace-me}"
RAZORPAY_KEY_SECRET_INPUT="${RAZORPAY_KEY_SECRET:-replace-me}"
RAZORPAY_WEBHOOK_SECRET_INPUT="${RAZORPAY_WEBHOOK_SECRET:-replace-me}"
UPI_PAYEE_VPA_INPUT="${UPI_PAYEE_VPA:-replace-me}"
UPI_PAYEE_NAME_INPUT="${UPI_PAYEE_NAME:-Qargo Logistics}"
EWAY_BILL_API_KEY_INPUT="${EWAY_BILL_API_KEY:-replace-me}"
INSURANCE_API_URL_INPUT="${INSURANCE_API_URL:-replace-me}"
INSURANCE_API_KEY_INPUT="${INSURANCE_API_KEY:-replace-me}"
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
    [--route-provider mock|google] \
    [--kyc-provider mock|idfy|cashfree] \
    [--push-provider mock|fcm] \
    [--otp-provider mock|twilio] \
    [--google-maps-api-key your-key] \
    [--idfy-api-key your-key] \
    [--idfy-api-url https://api.idfy.com/v3/tasks] \
    [--idfy-account-id your-account-id] \
    [--cashfree-client-id your-client-id] \
    [--cashfree-client-secret your-client-secret] \
    [--cashfree-kyc-api-url https://api.cashfree.com/verification/...] \
    [--cashfree-api-version 2023-08-01] \
    [--fcm-server-key your-key] \
    [--twilio-account-sid ACxxxx] \
    [--twilio-auth-token xxxx] \
    [--twilio-messaging-service-sid MGxxxx] \
    [--twilio-from-number +1xxxx] \
    [--razorpay-key-id rzp_test_xxxx] \
    [--razorpay-key-secret xxxx] \
    [--razorpay-webhook-secret xxxx] \
    [--upi-payee-vpa merchant@upi] \
    [--upi-payee-name "Qargo Logistics"] \
    [--eway-bill-api-key your-key] \
    [--insurance-api-url https://insurance.example] \
    [--insurance-api-key your-key] \
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
    --route-provider)
      ROUTE_PROVIDER_VALUE="$2"
      shift 2
      ;;
    --kyc-provider)
      KYC_PROVIDER_VALUE="$2"
      shift 2
      ;;
    --push-provider)
      PUSH_PROVIDER_VALUE="$2"
      shift 2
      ;;
    --otp-provider)
      OTP_PROVIDER_VALUE="$2"
      shift 2
      ;;
    --google-maps-api-key)
      GOOGLE_MAPS_API_KEY_INPUT="$2"
      shift 2
      ;;
    --idfy-api-key)
      IDFY_API_KEY_INPUT="$2"
      shift 2
      ;;
    --idfy-api-url)
      IDFY_API_URL_INPUT="$2"
      shift 2
      ;;
    --idfy-account-id)
      IDFY_ACCOUNT_ID_INPUT="$2"
      shift 2
      ;;
    --cashfree-client-id)
      CASHFREE_CLIENT_ID_INPUT="$2"
      shift 2
      ;;
    --cashfree-client-secret)
      CASHFREE_CLIENT_SECRET_INPUT="$2"
      shift 2
      ;;
    --cashfree-kyc-api-url)
      CASHFREE_KYC_API_URL_INPUT="$2"
      shift 2
      ;;
    --cashfree-api-version)
      CASHFREE_API_VERSION_INPUT="$2"
      shift 2
      ;;
    --fcm-server-key)
      FCM_SERVER_KEY_INPUT="$2"
      shift 2
      ;;
    --twilio-account-sid)
      TWILIO_ACCOUNT_SID_INPUT="$2"
      shift 2
      ;;
    --twilio-auth-token)
      TWILIO_AUTH_TOKEN_INPUT="$2"
      shift 2
      ;;
    --twilio-messaging-service-sid)
      TWILIO_MESSAGING_SERVICE_SID_INPUT="$2"
      shift 2
      ;;
    --twilio-from-number)
      TWILIO_FROM_NUMBER_INPUT="$2"
      shift 2
      ;;
    --razorpay-key-id)
      RAZORPAY_KEY_ID_INPUT="$2"
      shift 2
      ;;
    --razorpay-key-secret)
      RAZORPAY_KEY_SECRET_INPUT="$2"
      shift 2
      ;;
    --razorpay-webhook-secret)
      RAZORPAY_WEBHOOK_SECRET_INPUT="$2"
      shift 2
      ;;
    --upi-payee-vpa)
      UPI_PAYEE_VPA_INPUT="$2"
      shift 2
      ;;
    --upi-payee-name)
      UPI_PAYEE_NAME_INPUT="$2"
      shift 2
      ;;
    --eway-bill-api-key)
      EWAY_BILL_API_KEY_INPUT="$2"
      shift 2
      ;;
    --insurance-api-url)
      INSURANCE_API_URL_INPUT="$2"
      shift 2
      ;;
    --insurance-api-key)
      INSURANCE_API_KEY_INPUT="$2"
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
set_var "$BACKEND_SERVICE" "OTP_PROVIDER=$OTP_PROVIDER_VALUE"
set_var "$BACKEND_SERVICE" "ROUTE_PROVIDER=$ROUTE_PROVIDER_VALUE"
set_var "$BACKEND_SERVICE" "KYC_PROVIDER=$KYC_PROVIDER_VALUE"
set_var "$BACKEND_SERVICE" "PUSH_PROVIDER=$PUSH_PROVIDER_VALUE"
set_var "$BACKEND_SERVICE" "OTP_TTL_SECONDS=300"
set_var "$BACKEND_SERVICE" "OTP_FIXED_CODE=123456"
set_var "$BACKEND_SERVICE" "DISPATCH_RADIUS_KM=8"
set_var "$BACKEND_SERVICE" "WAITING_RATE_PER_MINUTE=3"
set_var "$BACKEND_SERVICE" "BASE_FARE_PER_KM=14"
set_var "$BACKEND_SERVICE" "GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY_INPUT:-replace-me}"
set_var "$BACKEND_SERVICE" "IDFY_API_KEY=$IDFY_API_KEY_INPUT"
set_var "$BACKEND_SERVICE" "IDFY_API_URL=$IDFY_API_URL_INPUT"
set_var "$BACKEND_SERVICE" "IDFY_ACCOUNT_ID=$IDFY_ACCOUNT_ID_INPUT"
set_var "$BACKEND_SERVICE" "CASHFREE_CLIENT_ID=$CASHFREE_CLIENT_ID_INPUT"
set_var "$BACKEND_SERVICE" "CASHFREE_CLIENT_SECRET=$CASHFREE_CLIENT_SECRET_INPUT"
set_var "$BACKEND_SERVICE" "CASHFREE_KYC_API_URL=$CASHFREE_KYC_API_URL_INPUT"
set_var "$BACKEND_SERVICE" "CASHFREE_API_VERSION=$CASHFREE_API_VERSION_INPUT"
set_var "$BACKEND_SERVICE" "FCM_SERVER_KEY=$FCM_SERVER_KEY_INPUT"
set_var "$BACKEND_SERVICE" "TWILIO_ACCOUNT_SID=$TWILIO_ACCOUNT_SID_INPUT"
set_var "$BACKEND_SERVICE" "TWILIO_AUTH_TOKEN=$TWILIO_AUTH_TOKEN_INPUT"
set_var "$BACKEND_SERVICE" "TWILIO_MESSAGING_SERVICE_SID=$TWILIO_MESSAGING_SERVICE_SID_INPUT"
set_var "$BACKEND_SERVICE" "TWILIO_FROM_NUMBER=$TWILIO_FROM_NUMBER_INPUT"
set_var "$BACKEND_SERVICE" "S3_ENDPOINT=replace-me"
set_var "$BACKEND_SERVICE" "S3_REGION=ap-south-1"
set_var "$BACKEND_SERVICE" "S3_BUCKET=replace-me"
set_var "$BACKEND_SERVICE" "S3_ACCESS_KEY_ID=replace-me"
set_var "$BACKEND_SERVICE" "S3_SECRET_ACCESS_KEY=replace-me"
set_var "$BACKEND_SERVICE" "RAZORPAY_KEY_ID=$RAZORPAY_KEY_ID_INPUT"
set_var "$BACKEND_SERVICE" "RAZORPAY_KEY_SECRET=$RAZORPAY_KEY_SECRET_INPUT"
set_var "$BACKEND_SERVICE" "RAZORPAY_WEBHOOK_SECRET=$RAZORPAY_WEBHOOK_SECRET_INPUT"
set_var "$BACKEND_SERVICE" "UPI_PAYEE_VPA=$UPI_PAYEE_VPA_INPUT"
set_var "$BACKEND_SERVICE" "UPI_PAYEE_NAME=$UPI_PAYEE_NAME_INPUT"
set_var "$BACKEND_SERVICE" "STRIPE_SECRET_KEY=replace-me"
set_var "$BACKEND_SERVICE" "GSTN_API_URL=https://sandbox.gstn.example"
set_var "$BACKEND_SERVICE" "EWAY_BILL_API_URL=https://sandbox.ewaybill.example"
set_var "$BACKEND_SERVICE" "EWAY_BILL_API_KEY=$EWAY_BILL_API_KEY_INPUT"
set_var "$BACKEND_SERVICE" "INSURANCE_API_URL=$INSURANCE_API_URL_INPUT"
set_var "$BACKEND_SERVICE" "INSURANCE_API_KEY=$INSURANCE_API_KEY_INPUT"

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
