import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpsertDriverProfileDto {
  @ApiProperty({ example: 'user-id' })
  @IsString()
  userId!: string;

  @ApiProperty({ required: false, example: 'Ravi Kumar' })
  @IsOptional()
  @IsString()
  fullName?: string;

  @ApiProperty({ required: false, example: '+919000000101' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false, example: 'ravi@example.com' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false, example: 'Bengaluru' })
  @IsOptional()
  @IsString()
  city?: string;
}

