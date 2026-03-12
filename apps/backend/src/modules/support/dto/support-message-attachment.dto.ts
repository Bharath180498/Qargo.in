import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class SupportMessageAttachmentDto {
  @IsString()
  @MaxLength(1024)
  fileKey!: string;

  @IsString()
  @MaxLength(2048)
  fileUrl!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  fileName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  contentType?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(15_000_000)
  fileSizeBytes?: number;
}
