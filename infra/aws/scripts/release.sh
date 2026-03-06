#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="$ROOT_DIR/infra/aws/terraform"
TAG=""
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
AUTO_APPROVE="true"
PUSH_LATEST="false"
SKIP_BUILD="false"

usage() {
  cat <<'EOF'
Build, push, and roll out a production release on AWS ECS.

Usage:
  ./infra/aws/scripts/release.sh [--tag <tag>] [--region <aws-region>] [--tf-dir <path>] [--no-auto-approve] [--push-latest] [--skip-build]

Examples:
  ./infra/aws/scripts/release.sh --region ap-south-1
  ./infra/aws/scripts/release.sh --tag release-2026-03-05 --region ap-south-1 --push-latest
  ./infra/aws/scripts/release.sh --tag hotfix-42 --skip-build
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

guess_region_from_tfvars() {
  local tfvars_file="$TF_DIR/terraform.tfvars"
  if [[ -f "$tfvars_file" ]]; then
    awk -F'=' '/^[[:space:]]*aws_region[[:space:]]*=/{gsub(/["[:space:]]/,"",$2);print $2;exit}' "$tfvars_file"
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --tag)
      TAG="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
      shift 2
      ;;
    --tf-dir)
      TF_DIR="$2"
      shift 2
      ;;
    --no-auto-approve)
      AUTO_APPROVE="false"
      shift
      ;;
    --push-latest)
      PUSH_LATEST="true"
      shift
      ;;
    --skip-build)
      SKIP_BUILD="true"
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

if [[ -z "$REGION" ]]; then
  REGION="$(guess_region_from_tfvars || true)"
fi

if [[ -z "$REGION" ]]; then
  echo "AWS region not provided. Use --region or set AWS_REGION/AWS_DEFAULT_REGION." >&2
  exit 1
fi

if [[ -z "$TAG" ]]; then
  TAG="$(git -C "$ROOT_DIR" rev-parse --short HEAD)-$(date +%Y%m%d%H%M)"
fi

require_cmd terraform
require_cmd aws
require_cmd curl

if [[ ! -d "$TF_DIR" ]]; then
  echo "Terraform directory not found: $TF_DIR" >&2
  exit 1
fi

if [[ "$SKIP_BUILD" == "false" ]]; then
  require_cmd docker
  build_cmd=(
    "$ROOT_DIR/infra/aws/scripts/build_and_push.sh"
    --tag "$TAG"
    --region "$REGION"
    --tf-dir "$TF_DIR"
  )
  if [[ "$PUSH_LATEST" == "true" ]]; then
    build_cmd+=(--push-latest)
  fi
  "${build_cmd[@]}"
fi

echo "Applying terraform with image tag: $TAG"
if [[ "$AUTO_APPROVE" == "true" ]]; then
  terraform -chdir="$TF_DIR" apply \
    -var "backend_image_tag=$TAG" \
    -var "admin_image_tag=$TAG" \
    -auto-approve
else
  terraform -chdir="$TF_DIR" apply \
    -var "backend_image_tag=$TAG" \
    -var "admin_image_tag=$TAG"
fi

CLUSTER_NAME="$(terraform -chdir="$TF_DIR" output -raw ecs_cluster_name)"
BACKEND_SERVICE="$(terraform -chdir="$TF_DIR" output -raw backend_service_name)"
ADMIN_SERVICE="$(terraform -chdir="$TF_DIR" output -raw admin_service_name)"

echo "Waiting for ECS services to stabilize..."
aws ecs wait services-stable \
  --cluster "$CLUSTER_NAME" \
  --services "$BACKEND_SERVICE" "$ADMIN_SERVICE" \
  --region "$REGION"

API_URL="$(terraform -chdir="$TF_DIR" output -raw backend_api_url)"
ADMIN_URL="$(terraform -chdir="$TF_DIR" output -raw admin_url)"

echo "Running smoke checks..."
curl -fsS "$API_URL/health" >/dev/null
curl -fsS -I "$ADMIN_URL" >/dev/null

echo "Release complete."
echo "Tag: $TAG"
echo "Admin: $ADMIN_URL"
echo "API: $API_URL"
