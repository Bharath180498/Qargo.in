import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectAgentActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
