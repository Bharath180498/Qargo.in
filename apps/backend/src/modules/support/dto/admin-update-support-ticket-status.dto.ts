import { SupportTicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminUpdateSupportTicketStatusDto {
  @IsEnum(SupportTicketStatus)
  status!: SupportTicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
