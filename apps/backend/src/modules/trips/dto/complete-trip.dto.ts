import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength
} from 'class-validator';

export class CompleteTripDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  durationMinutes?: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(220)
  deliveryPhotoFileKey!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  @MaxLength(800)
  deliveryPhotoUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  deliveryPhotoMimeType?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(120)
  receiverName!: string;

  @IsString()
  @IsNotEmpty()
  receiverSignature!: string;
}
