import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';

class EnvSchema {
  @IsString()
  DATABASE_URL!: string;

  @IsString()
  REDIS_URL!: string;

  @IsString()
  JWT_SECRET!: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  PORT?: number;

  @IsOptional()
  @IsString()
  AUTH_MODE?: string;

  @IsOptional()
  @IsString()
  ROUTE_PROVIDER?: string;

  @IsOptional()
  @IsString()
  KYC_PROVIDER?: string;

  @IsOptional()
  @IsString()
  PUSH_PROVIDER?: string;

  @IsOptional()
  @IsString()
  GOOGLE_MAPS_API_KEY?: string;

  @IsOptional()
  @IsString()
  IDFY_API_KEY?: string;

  @IsOptional()
  @IsString()
  FCM_SERVER_KEY?: string;

  @IsOptional()
  @IsString()
  OTP_FIXED_CODE?: string;

  @IsOptional()
  @IsInt()
  @Min(60)
  OTP_TTL_SECONDS?: number;

  @IsOptional()
  @IsString()
  S3_ENDPOINT?: string;

  @IsOptional()
  @IsString()
  S3_REGION?: string;

  @IsOptional()
  @IsString()
  S3_BUCKET?: string;

  @IsOptional()
  @IsString()
  S3_ACCESS_KEY_ID?: string;

  @IsOptional()
  @IsString()
  S3_SECRET_ACCESS_KEY?: string;
}

export function validateEnv(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvSchema, config, { enableImplicitConversion: true });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return config;
}
