import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SendPushBroadcastDto {
  @ApiProperty({ enum: ['customer', 'driver', 'all'], example: 'customer' })
  @IsString()
  recipient!: 'customer' | 'driver' | 'all';

  @ApiProperty({ example: 'QARGO Offer' })
  @IsString()
  @MaxLength(80)
  title!: string;

  @ApiProperty({ example: 'Get launch pricing on your next booking.' })
  @IsString()
  @MaxLength(240)
  body!: string;

  @ApiProperty({ required: false, example: { campaign: 'launch-offer' } })
  @IsOptional()
  @IsObject()
  data?: Record<string, unknown>;

  @ApiProperty({ required: false, minimum: 1, maximum: 5000, example: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5000)
  maxRecipients?: number;
}
