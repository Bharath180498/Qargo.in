import { ApiProperty } from '@nestjs/swagger';
import { VehicleType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpsertDriverVehicleDto {
  @ApiProperty({ example: 'user-id' })
  @IsString()
  userId!: string;

  @ApiProperty({ enum: VehicleType, example: VehicleType.MINI_TRUCK })
  @IsEnum(VehicleType)
  vehicleType!: VehicleType;

  @ApiProperty({ example: 'KA01AB1234' })
  @IsString()
  vehicleNumber!: string;

  @ApiProperty({ example: 'DL-0420120012345' })
  @IsString()
  licenseNumber!: string;

  @ApiProperty({ required: false, example: '123412341234' })
  @IsOptional()
  @IsString()
  aadhaarNumber?: string;

  @ApiProperty({ required: false, example: 'KA01RC1234' })
  @IsOptional()
  @IsString()
  rcNumber?: string;
}

