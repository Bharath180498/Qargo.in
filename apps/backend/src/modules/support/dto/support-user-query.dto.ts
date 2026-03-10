import { IsString } from 'class-validator';

export class SupportUserQueryDto {
  @IsString()
  userId!: string;
}
