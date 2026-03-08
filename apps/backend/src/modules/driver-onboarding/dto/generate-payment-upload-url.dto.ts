import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GeneratePaymentUploadUrlDto {
  @ApiProperty({ example: 'user-id' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'upi-qr.png' })
  @IsString()
  fileName!: string;

  @ApiProperty({ example: 'image/png', required: false })
  @IsOptional()
  @IsString()
  contentType?: string;
}
