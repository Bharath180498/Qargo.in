#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
TF_DIR="$ROOT_DIR/infra/aws/terraform"
TAG=""
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"
PUSH_LATEST="false"

usage() {
  cat <<'EOF'
Build and push backend/admin images to ECR.

Usage:
  ./infra/aws/scripts/build_and_push.sh --tag <tag> [--region <aws-region>] [--tf-dir <path>] [--push-latest]

Examples:
  ./infra/aws/scripts/build_and_push.sh --tag "$(git rev-parse --short HEAD)" --region ap-south-1
  ./infra/aws/scripts/build_and_push.sh --tag release-2026-03-05 --push-latest
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
    --push-latest)
      PUSH_LATEST="true"
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

if [[ -z "$TAG" ]]; then
  echo "Missing --tag" >&2
  usage
  exit 1
fi

if [[ -z "$REGION" ]]; then
  REGION="$(guess_region_from_tfvars || true)"
fi

if [[ -z "$REGION" ]]; then
  echo "AWS region not provided. Use --region or set AWS_REGION/AWS_DEFAULT_REGION." >&2
  exit 1
fi

require_cmd aws
require_cmd docker
require_cmd terraform

if [[ ! -d "$TF_DIR" ]]; then
  echo "Terraform directory not found: $TF_DIR" >&2
  exit 1
fi

echo "Using terraform dir: $TF_DIR"
echo "Using region: $REGION"
echo "Using image tag: $TAG"

BACKEND_REPO="$(terraform -chdir="$TF_DIR" output -raw backend_ecr_repository_url)"
ADMIN_REPO="$(terraform -chdir="$TF_DIR" output -raw admin_ecr_repository_url)"

if [[ -z "$BACKEND_REPO" || -z "$ADMIN_REPO" ]]; then
  echo "Could not resolve ECR repositories from terraform outputs. Run terraform apply first." >&2
  exit 1
fi

aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$(echo "$BACKEND_REPO" | cut -d'/' -f1)"

cd "$ROOT_DIR"

echo "Building backend image..."
docker build --platform linux/amd64 -f apps/backend/Dockerfile -t "$BACKEND_REPO:$TAG" .

echo "Building admin image..."
docker build --platform linux/amd64 -f apps/admin/Dockerfile -t "$ADMIN_REPO:$TAG" .

echo "Pushing tagged images..."
docker push "$BACKEND_REPO:$TAG"
docker push "$ADMIN_REPO:$TAG"

if [[ "$PUSH_LATEST" == "true" ]]; then
  echo "Tagging and pushing latest..."
  docker tag "$BACKEND_REPO:$TAG" "$BACKEND_REPO:latest"
  docker tag "$ADMIN_REPO:$TAG" "$ADMIN_REPO:latest"
  docker push "$BACKEND_REPO:latest"
  docker push "$ADMIN_REPO:latest"
fi

echo "Done."
echo "BACKEND_IMAGE=$BACKEND_REPO:$TAG"
echo "ADMIN_IMAGE=$ADMIN_REPO:$TAG"
