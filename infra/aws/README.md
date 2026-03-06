# AWS Deployment

Production infrastructure is defined in `infra/aws/terraform` and deployed on:

- ECS Fargate (backend + admin)
- ALB (public ingress)
- RDS PostgreSQL (Multi-AZ)
- ElastiCache Redis (replication group)
- ECR (backend/admin images)
- CloudWatch + SNS alarms
- Secrets Manager (runtime secrets)

## Quick Start

1. Bootstrap remote Terraform state (recommended):
   ```bash
   ./infra/aws/scripts/bootstrap_tf_backend.sh \
     --bucket samaangaadi-terraform-state-prod \
     --table samaangaadi-terraform-locks \
     --region ap-south-1
   cp infra/aws/terraform/backend.hcl.example infra/aws/terraform/backend.hcl
   terraform -chdir=infra/aws/terraform init -backend-config=backend.hcl -reconfigure
   ```
2. Copy and edit variables:
   ```bash
   cp infra/aws/terraform/terraform.tfvars.example infra/aws/terraform/terraform.tfvars
   ```
3. Create infra:
   ```bash
   terraform -chdir=infra/aws/terraform init
   terraform -chdir=infra/aws/terraform apply
   ```
4. Release app:
   ```bash
   ./infra/aws/scripts/release.sh --region ap-south-1
   ```

Detailed launch process is documented in [`docs/LAUNCH_RUNBOOK.md`](./docs/LAUNCH_RUNBOOK.md).

## Scripts

- `infra/aws/scripts/bootstrap_tf_backend.sh`: creates S3 + DynamoDB for Terraform remote state.
- `infra/aws/scripts/build_and_push.sh`: builds backend/admin Docker images and pushes to ECR.
- `infra/aws/scripts/release.sh`: build + push + terraform apply + ECS wait + smoke checks.
