import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DispatchOfferActionDto {
  @ApiProperty({ example: 'driver-profile-id' })
  @IsString()
  driverId!: string;

  @ApiProperty({ required: false, example: 'driver-payment-method-id' })
  @IsOptional()
  @IsString()
  driverPaymentMethodId?: string;
}
