import { ApiProperty } from '@nestjs/swagger';
import { KycDocType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class GenerateUploadUrlDto {
  @ApiProperty({ example: 'user-id' })
  @IsString()
  userId!: string;

  @ApiProperty({ enum: KycDocType, example: KycDocType.AADHAAR_FRONT })
  @IsEnum(KycDocType)
  type!: KycDocType;

  @ApiProperty({ example: 'aadhaar-front.jpg' })
  @IsString()
  fileName!: string;

  @ApiProperty({ required: false, example: 'image/jpeg' })
  @IsOptional()
  @IsString()
  contentType?: string;
}

