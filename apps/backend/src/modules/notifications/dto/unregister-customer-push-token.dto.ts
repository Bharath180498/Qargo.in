import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UnregisterCustomerPushTokenDto {
  @ApiProperty({ example: 'customer-user-id' })
  @IsString()
  customerId!: string;

  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]' })
  @IsString()
  token!: string;
}
