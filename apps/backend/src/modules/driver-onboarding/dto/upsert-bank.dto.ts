import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpsertDriverBankDto {
  @ApiProperty({ example: 'user-id' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'Ravi Kumar' })
  @IsString()
  accountHolderName!: string;

  @ApiProperty({ example: 'HDFC Bank' })
  @IsString()
  bankName!: string;

  @ApiProperty({ example: '123456789000' })
  @IsString()
  accountNumber!: string;

  @ApiProperty({ example: 'HDFC0000123' })
  @IsString()
  ifscCode!: string;

  @ApiProperty({ required: false, example: 'ravi@okhdfcbank' })
  @IsOptional()
  @IsString()
  upiId?: string;
}

