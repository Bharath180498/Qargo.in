import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateAgentMessageDto {
  @IsString()
  @MaxLength(5000)
  message!: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
