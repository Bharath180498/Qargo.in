import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class RequestOtpDto {
  @ApiProperty({ example: '+919000000101' })
  @IsString()
  phone!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.DRIVER })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ required: false, example: 'Ravi Kumar' })
  @IsOptional()
  @IsString()
  name?: string;
}

