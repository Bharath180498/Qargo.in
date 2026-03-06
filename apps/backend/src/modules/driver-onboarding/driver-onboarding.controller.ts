import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { DriverOnboardingService } from './driver-onboarding.service';
import { UpsertDriverProfileDto } from './dto/upsert-profile.dto';
import { UpsertDriverVehicleDto } from './dto/upsert-vehicle.dto';
import { UpsertDriverBankDto } from './dto/upsert-bank.dto';
import { SubmitDriverOnboardingDto } from './dto/submit-onboarding.dto';

@Controller('driver-onboarding')
export class DriverOnboardingController {
  constructor(private readonly onboardingService: DriverOnboardingService) {}

  @Get('me')
  me(@Query('userId') userId: string) {
    return this.onboardingService.me(userId);
  }

  @Post('profile')
  profile(@Body() payload: UpsertDriverProfileDto) {
    return this.onboardingService.upsertProfile(payload);
  }

  @Post('vehicle')
  vehicle(@Body() payload: UpsertDriverVehicleDto) {
    return this.onboardingService.upsertVehicle(payload);
  }

  @Post('bank')
  bank(@Body() payload: UpsertDriverBankDto) {
    return this.onboardingService.upsertBank(payload);
  }

  @Post('submit')
  submit(@Body() payload: SubmitDriverOnboardingDto) {
    return this.onboardingService.submit(payload.userId);
  }
}

