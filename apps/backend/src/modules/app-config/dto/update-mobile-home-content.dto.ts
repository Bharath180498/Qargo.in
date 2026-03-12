import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested
} from 'class-validator';

export class UpdateMobileHomeBillboardDto {
  @IsString()
  @MaxLength(40)
  eyebrow!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(180)
  subtitle!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags!: string[];
}

export class UpdateMobileHomePromoDto {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  id?: string;

  @IsString()
  @MaxLength(40)
  tag!: string;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(180)
  subtitle!: string;

  @IsString()
  @MaxLength(32)
  cta!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @IsString({ each: true })
  colors!: [string, string];
}

export class UpdateMobileHomeContentDto {
  @ValidateNested()
  @Type(() => UpdateMobileHomeBillboardDto)
  billboard!: UpdateMobileHomeBillboardDto;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => UpdateMobileHomePromoDto)
  promos!: UpdateMobileHomePromoDto[];
}
