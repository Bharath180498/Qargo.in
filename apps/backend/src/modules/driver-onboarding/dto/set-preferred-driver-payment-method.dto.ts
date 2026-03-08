import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SetPreferredDriverPaymentMethodDto {
  @ApiProperty({ example: 'user-id' })
  @IsString()
  userId!: string;
}
