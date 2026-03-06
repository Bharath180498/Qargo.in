import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RegisterPushTokenDto {
  @ApiProperty({ example: 'driver-profile-id' })
  @IsString()
  driverId!: string;

  @ApiProperty({ example: 'ExponentPushToken[xxx]' })
  @IsString()
  token!: string;

  @ApiProperty({ example: 'ios' })
  @IsString()
  platform!: string;

  @ApiProperty({ required: false, example: '0.1.0' })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiProperty({ required: false, example: 'iphone-15-pro' })
  @IsOptional()
  @IsString()
  deviceId?: string;
}

