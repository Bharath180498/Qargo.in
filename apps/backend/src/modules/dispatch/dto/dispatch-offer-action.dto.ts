import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class DispatchOfferActionDto {
  @ApiProperty({ example: 'driver-profile-id' })
  @IsString()
  driverId!: string;
}

