output "alb_dns_name" {
  description = "Public ALB DNS"
  value       = aws_lb.main.dns_name
}

output "public_base_url" {
  description = "Public base URL for admin/backend"
  value       = local.public_base_url
}

output "admin_url" {
  description = "Admin dashboard URL"
  value       = local.public_base_url
}

output "backend_api_url" {
  description = "Backend API URL"
  value       = "${local.public_base_url}/api"
}

output "backend_ecr_repository_url" {
  description = "Backend ECR repository URL"
  value       = aws_ecr_repository.backend.repository_url
}

output "admin_ecr_repository_url" {
  description = "Admin ECR repository URL"
  value       = aws_ecr_repository.admin.repository_url
}

output "ecs_cluster_name" {
  description = "ECS cluster name"
  value       = aws_ecs_cluster.main.name
}

output "backend_service_name" {
  description = "Backend ECS service name"
  value       = aws_ecs_service.backend.name
}

output "admin_service_name" {
  description = "Admin ECS service name"
  value       = aws_ecs_service.admin.name
}

output "db_endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.postgres.address
}

output "redis_primary_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.redis.primary_endpoint_address
}

output "backend_secret_arn" {
  description = "Secrets Manager ARN for backend runtime"
  value       = aws_secretsmanager_secret.backend.arn
}
