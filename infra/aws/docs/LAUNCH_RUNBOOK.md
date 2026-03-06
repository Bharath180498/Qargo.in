# Launch Runbook (T-1 Day)

This runbook is for a production launch with the current monorepo setup.

## 1. Preconditions

- AWS account with permissions for VPC, ECS, ECR, ALB, RDS, ElastiCache, IAM, CloudWatch, Secrets Manager, Route53, ACM, SNS.
- Tools installed locally:
  - `aws` CLI v2
  - `terraform` >= 1.5
  - `docker`
  - `node` >= 20
- Domain + SSL certificate ready in ACM (same region as ALB).

## 2. One-Time Infra Setup

1. Configure AWS credentials:
   ```bash
   aws configure
   aws sts get-caller-identity
   ```
2. Bootstrap remote Terraform state backend:
   ```bash
   ./infra/aws/scripts/bootstrap_tf_backend.sh \
     --bucket samaangaadi-terraform-state-prod \
     --table samaangaadi-terraform-locks \
     --region ap-south-1
   cp infra/aws/terraform/backend.hcl.example infra/aws/terraform/backend.hcl
   terraform -chdir=infra/aws/terraform init -backend-config=backend.hcl -reconfigure
   ```
3. Create Terraform vars:
   ```bash
   cp infra/aws/terraform/terraform.tfvars.example infra/aws/terraform/terraform.tfvars
   ```
4. Edit `infra/aws/terraform/terraform.tfvars`:
   - set `acm_certificate_arn`
   - set `route53_zone_id`, `route53_record_name`
   - set strong `db_password`, `jwt_secret`
   - set provider keys/secrets
   - confirm sizing values
5. Deploy infra:
   ```bash
   terraform -chdir=infra/aws/terraform init
   terraform -chdir=infra/aws/terraform plan
   terraform -chdir=infra/aws/terraform apply
   ```

## 3. Release Procedure

Use one command to build images, push to ECR, apply Terraform image tags, and wait for ECS stability.

```bash
./infra/aws/scripts/release.sh --region ap-south-1
```

Optional:

- force a specific version tag:
  ```bash
  ./infra/aws/scripts/release.sh --region ap-south-1 --tag release-2026-03-06
  ```
- only roll infra to an existing image tag:
  ```bash
  ./infra/aws/scripts/release.sh --region ap-south-1 --tag release-2026-03-06 --skip-build
  ```

## 4. Smoke Tests (Post Deploy)

1. Confirm outputs:
   ```bash
   terraform -chdir=infra/aws/terraform output admin_url
   terraform -chdir=infra/aws/terraform output backend_api_url
   ```
2. Backend health:
   ```bash
   curl -sS "$(terraform -chdir=infra/aws/terraform output -raw backend_api_url)/health"
   ```
3. Admin health:
   ```bash
   curl -I "$(terraform -chdir=infra/aws/terraform output -raw admin_url)"
   ```
4. App flow sanity:
   - Create order estimate from mobile app
   - Create order
   - Verify assignment + tracking websocket updates
   - Verify admin dashboard loads metrics

## 5. Mobile Production Config

Update mobile API URL before release builds:

- `apps/mobile/app.json` -> `expo.extra.apiBaseUrl`
- set to your public backend API URL, e.g.:
  - `https://app.samaangaadi.in/api`

For App Store builds, prefer EAS build profiles with environment-specific API base URL.

## 6. Observability + Alerting

Provisioned by Terraform:

- CloudWatch log groups for backend/admin containers
- ALB 5xx alarm
- Backend unhealthy target alarm
- RDS CPU alarm
- Optional SNS email notifications (`alert_email`)

Before launch:

- confirm SNS email subscription
- validate logs are appearing in CloudWatch
- verify alarm state is `OK`

## 7. Rollback Procedure

1. Pick last known good image tag (from ECR).
2. Redeploy that tag:
   ```bash
   ./infra/aws/scripts/release.sh --region ap-south-1 --tag <last-good-tag> --skip-build
   ```
3. Wait for ECS stabilization and re-run smoke tests.

## 8. Go-Live Checklist

- `terraform plan` has no unexpected drift
- API + admin health endpoints pass
- TLS valid for public domain
- DB automated backups enabled and retention verified
- Redis replication group healthy
- CloudWatch alarms + SNS notification tested
- Mobile app points to production API URL
- On-call owner + rollback tag documented

## 9. Optional CI/CD (GitHub Actions)

Workflow: `.github/workflows/deploy-aws.yml`

Set these GitHub Environment values (environment: `production`):

- `AWS_REGION`
- `TF_STATE_BUCKET`
- `TF_STATE_KEY`
- `TF_STATE_LOCK_TABLE`

Set these GitHub Environment secrets:

- `AWS_DEPLOY_ROLE_ARN` (OIDC-assumable role)
- `TFVARS_PROD` (full terraform tfvars content)

Then trigger `Deploy AWS Prod` from Actions, optionally with a custom `image_tag`.
