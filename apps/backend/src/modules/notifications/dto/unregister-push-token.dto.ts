import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UnregisterPushTokenDto {
  @ApiProperty({ example: 'driver-profile-id' })
  @IsString()
  driverId!: string;

  @ApiProperty({ example: 'ExponentPushToken[xxx]' })
  @IsString()
  token!: string;
}

