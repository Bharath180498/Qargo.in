import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AdminPasscodeLoginDto {
  @ApiProperty({ example: 'launch-admin-2026' })
  @IsString()
  @MinLength(4)
  @MaxLength(128)
  passcode!: string;
}
