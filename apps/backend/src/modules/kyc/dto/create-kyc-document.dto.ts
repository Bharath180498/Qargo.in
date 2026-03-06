import { ApiProperty } from '@nestjs/swagger';
import { KycDocType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateKycDocumentDto {
  @ApiProperty({ example: 'user-id' })
  @IsString()
  userId!: string;

  @ApiProperty({ required: false, example: 'onboarding-id' })
  @IsOptional()
  @IsString()
  onboardingId?: string;

  @ApiProperty({ enum: KycDocType, example: KycDocType.LICENSE_FRONT })
  @IsEnum(KycDocType)
  type!: KycDocType;

  @ApiProperty({ example: 'kyc/user-id/license-front.jpg' })
  @IsString()
  fileKey!: string;

  @ApiProperty({ example: 'https://bucket.example/kyc/user-id/license-front.jpg' })
  @IsString()
  fileUrl!: string;

  @ApiProperty({ required: false, example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiProperty({ required: false, example: 345678 })
  @IsOptional()
  @IsInt()
  @Min(1)
  fileSizeBytes?: number;
}

