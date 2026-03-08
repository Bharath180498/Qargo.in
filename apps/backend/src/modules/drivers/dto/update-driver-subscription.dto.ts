import { DriverSubscriptionPlan } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateDriverSubscriptionDto {
  @IsEnum(DriverSubscriptionPlan)
  plan!: DriverSubscriptionPlan;
}
