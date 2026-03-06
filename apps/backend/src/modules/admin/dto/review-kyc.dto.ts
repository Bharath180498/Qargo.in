import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class ReviewKycDto {
  @ApiProperty({ required: false, example: 'Documents match manual review checklist' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiProperty({ required: false, example: 'admin-user-id' })
  @IsOptional()
  @IsString()
  adminUserId?: string;
}

