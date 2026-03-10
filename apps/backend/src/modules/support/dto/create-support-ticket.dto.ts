import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateSupportTicketDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(140)
  subject!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  description!: string;

  @IsOptional()
  @IsString()
  orderId?: string;

  @IsOptional()
  @IsString()
  tripId?: string;
}
