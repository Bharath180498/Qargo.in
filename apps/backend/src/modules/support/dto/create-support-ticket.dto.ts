import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested
} from 'class-validator';
import { SupportMessageAttachmentDto } from './support-message-attachment.dto';

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

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SupportMessageAttachmentDto)
  attachments?: SupportMessageAttachmentDto[];
}
