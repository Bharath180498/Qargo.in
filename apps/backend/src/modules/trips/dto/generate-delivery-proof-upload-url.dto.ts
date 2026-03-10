import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class GenerateDeliveryProofUploadUrlDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  driverId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  contentType!: string;
}
