import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

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

  @ApiProperty({ example: 'ravi@okhdfcbank' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9.\-_]{2,}@[a-zA-Z]{2,}$/i, {
    message: 'UPI ID must be in valid format (example: name@bank)'
  })
  upiId!: string;

  @ApiProperty({ example: 'https://cdn.example.com/driver-upi-qr.png', required: false })
  @IsOptional()
  @IsString()
  upiQrImageUrl?: string;
}
