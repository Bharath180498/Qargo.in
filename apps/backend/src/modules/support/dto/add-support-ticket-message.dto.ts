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

export class AddSupportTicketMessageDto {
  @IsString()
  userId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => SupportMessageAttachmentDto)
  attachments?: SupportMessageAttachmentDto[];
}
