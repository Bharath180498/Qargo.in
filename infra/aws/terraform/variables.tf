variable "project_name" {
  description = "Project name used in AWS resource naming"
  type        = string
  default     = "samaan-gaadi"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "prod"
}

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.40.0.0/16"
}

variable "availability_zone_count" {
  description = "Number of AZs to use"
  type        = number
  default     = 2
}

variable "backend_cpu" {
  description = "Backend ECS task CPU units"
  type        = number
  default     = 1024
}

variable "backend_memory" {
  description = "Backend ECS task memory (MiB)"
  type        = number
  default     = 2048
}

variable "backend_desired_count" {
  description = "Desired task count for backend service"
  type        = number
  default     = 2
}

variable "backend_min_count" {
  description = "Minimum autoscale task count for backend"
  type        = number
  default     = 2
}

variable "backend_max_count" {
  description = "Maximum autoscale task count for backend"
  type        = number
  default     = 10
}

variable "admin_cpu" {
  description = "Admin ECS task CPU units"
  type        = number
  default     = 512
}

variable "admin_memory" {
  description = "Admin ECS task memory (MiB)"
  type        = number
  default     = 1024
}

variable "admin_desired_count" {
  description = "Desired task count for admin service"
  type        = number
  default     = 2
}

variable "admin_min_count" {
  description = "Minimum autoscale task count for admin"
  type        = number
  default     = 2
}

variable "admin_max_count" {
  description = "Maximum autoscale task count for admin"
  type        = number
  default     = 6
}

variable "backend_image_tag" {
  description = "Docker image tag for backend ECR image"
  type        = string
  default     = "latest"
}

variable "admin_image_tag" {
  description = "Docker image tag for admin ECR image"
  type        = string
  default     = "latest"
}

variable "public_base_url" {
  description = "Public base URL of the platform. Leave empty to use ALB URL"
  type        = string
  default     = ""
}

variable "acm_certificate_arn" {
  description = "ACM certificate ARN for HTTPS listener. Leave empty for HTTP-only"
  type        = string
  default     = ""
}

variable "route53_zone_id" {
  description = "Route53 hosted zone ID (optional)"
  type        = string
  default     = ""
}

variable "route53_record_name" {
  description = "Route53 record name to map to ALB (optional)"
  type        = string
  default     = ""
}

variable "db_name" {
  description = "RDS database name"
  type        = string
  default     = "porter"
}

variable "db_username" {
  description = "RDS database user"
  type        = string
  default     = "porter"
}

variable "db_password" {
  description = "RDS database password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t4g.medium"
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = true
}

variable "db_deletion_protection" {
  description = "Protect DB from accidental deletion"
  type        = bool
  default     = true
}

variable "db_backup_retention_days" {
  description = "RDS backup retention in days"
  type        = number
  default     = 14
}

variable "db_performance_insights_enabled" {
  description = "Enable Performance Insights on RDS"
  type        = bool
  default     = true
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 100
}

variable "db_max_allocated_storage" {
  description = "RDS max autoscaling storage in GB"
  type        = number
  default     = 300
}

variable "redis_node_type" {
  description = "ElastiCache node type"
  type        = string
  default     = "cache.t4g.small"
}

variable "redis_num_cache_clusters" {
  description = "Number of Redis cache nodes"
  type        = number
  default     = 2
}

variable "redis_transit_encryption_enabled" {
  description = "Enable in-transit encryption for Redis"
  type        = bool
  default     = true
}

variable "jwt_secret" {
  description = "Backend JWT secret"
  type        = string
  sensitive   = true
}

variable "jwt_expires_in" {
  description = "JWT expiration window"
  type        = string
  default     = "7d"
}

variable "dispatch_radius_km" {
  description = "Driver dispatch radius"
  type        = number
  default     = 8
}

variable "waiting_rate_per_minute" {
  description = "Waiting charge rate per minute"
  type        = number
  default     = 3
}

variable "base_fare_per_km" {
  description = "Base fare multiplier per km"
  type        = number
  default     = 14
}

variable "fcm_server_key" {
  description = "Firebase server key"
  type        = string
  default     = "replace-me"
  sensitive   = true
}

variable "razorpay_key_id" {
  description = "Razorpay key id"
  type        = string
  default     = "replace-me"
  sensitive   = true
}

variable "razorpay_key_secret" {
  description = "Razorpay key secret"
  type        = string
  default     = "replace-me"
  sensitive   = true
}

variable "stripe_secret_key" {
  description = "Stripe secret key"
  type        = string
  default     = "replace-me"
  sensitive   = true
}

variable "gstn_api_url" {
  description = "GSTN API URL"
  type        = string
  default     = "https://sandbox.gstn.example"
}

variable "eway_bill_api_url" {
  description = "E-way bill API URL"
  type        = string
  default     = "https://sandbox.ewaybill.example"
}

variable "alert_email" {
  description = "Email for CloudWatch alarm notifications"
  type        = string
  default     = ""
}

variable "enable_execute_command" {
  description = "Enable ECS Exec for live debugging"
  type        = bool
  default     = true
}
