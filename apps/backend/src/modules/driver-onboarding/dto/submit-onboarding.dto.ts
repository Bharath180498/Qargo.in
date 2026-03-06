import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SubmitDriverOnboardingDto {
  @ApiProperty({ example: 'user-id' })
  @IsString()
  userId!: string;
}

