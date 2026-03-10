import { TripStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

export class AdminOperationsRidesQueryDto {
  @IsOptional()
  @IsIn(['active', 'recent', 'all'])
  scope?: 'active' | 'recent' | 'all';

  @IsOptional()
  @IsEnum(TripStatus)
  status?: TripStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
