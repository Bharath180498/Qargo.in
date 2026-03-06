#!/usr/bin/env bash
set -euo pipefail

BUCKET=""
TABLE=""
REGION="${AWS_REGION:-${AWS_DEFAULT_REGION:-}}"

usage() {
  cat <<'EOF'
Bootstrap Terraform remote state backend in AWS (S3 + DynamoDB lock table).

Usage:
  ./infra/aws/scripts/bootstrap_tf_backend.sh --bucket <s3-bucket> --table <dynamodb-table> --region <aws-region>

Example:
  ./infra/aws/scripts/bootstrap_tf_backend.sh \
    --bucket samaangaadi-terraform-state-prod \
    --table samaangaadi-terraform-locks \
    --region ap-south-1
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
    --bucket)
      BUCKET="$2"
      shift 2
      ;;
    --table)
      TABLE="$2"
      shift 2
      ;;
    --region)
      REGION="$2"
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

if [[ -z "$BUCKET" || -z "$TABLE" || -z "$REGION" ]]; then
  echo "Missing required arguments." >&2
  usage
  exit 1
fi

require_cmd aws

echo "Creating S3 backend bucket if it does not exist..."
if aws s3api head-bucket --bucket "$BUCKET" 2>/dev/null; then
  echo "Bucket exists: $BUCKET"
else
  if [[ "$REGION" == "us-east-1" ]]; then
    aws s3api create-bucket --bucket "$BUCKET"
  else
    aws s3api create-bucket \
      --bucket "$BUCKET" \
      --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  echo "Bucket created: $BUCKET"
fi

aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

aws s3api put-bucket-versioning \
  --bucket "$BUCKET" \
  --versioning-configuration Status=Enabled

aws s3api put-bucket-encryption \
  --bucket "$BUCKET" \
  --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'

echo "Creating DynamoDB lock table if it does not exist..."
if aws dynamodb describe-table --table-name "$TABLE" --region "$REGION" >/dev/null 2>&1; then
  echo "Table exists: $TABLE"
else
  aws dynamodb create-table \
    --table-name "$TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  aws dynamodb wait table-exists --table-name "$TABLE" --region "$REGION"
  echo "Table created: $TABLE"
fi

cat <<EOF

Bootstrap complete.

Next:
1. Create backend config:
   cp infra/aws/terraform/backend.hcl.example infra/aws/terraform/backend.hcl
2. Edit backend.hcl values for bucket/table/region.
3. Initialize terraform with remote state:
   terraform -chdir=infra/aws/terraform init -backend-config=backend.hcl -reconfigure

EOF
