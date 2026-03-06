import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty({ example: '+919000000101' })
  @IsString()
  phone!: string;

  @ApiProperty({ enum: UserRole, example: UserRole.DRIVER })
  @IsEnum(UserRole)
  role!: UserRole;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(4, 8)
  code!: string;

  @ApiProperty({ required: false, example: 'Ravi Kumar' })
  @IsOptional()
  @IsString()
  name?: string;
}

