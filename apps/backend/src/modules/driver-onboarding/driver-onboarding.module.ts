import { Module } from '@nestjs/common';
import { DriverOnboardingController } from './driver-onboarding.controller';
import { DriverOnboardingService } from './driver-onboarding.service';

@Module({
  controllers: [DriverOnboardingController],
  providers: [DriverOnboardingService],
  exports: [DriverOnboardingService]
})
export class DriverOnboardingModule {}

