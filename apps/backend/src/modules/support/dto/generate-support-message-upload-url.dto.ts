import { IsOptional, IsString } from 'class-validator';

export class GenerateSupportMessageUploadUrlDto {
  @IsString()
  userId!: string;

  @IsString()
  fileName!: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
