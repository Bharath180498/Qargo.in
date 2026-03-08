import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { DriverOnboardingService } from './driver-onboarding.service';
import { UpsertDriverProfileDto } from './dto/upsert-profile.dto';
import { UpsertDriverVehicleDto } from './dto/upsert-vehicle.dto';
import { UpsertDriverBankDto } from './dto/upsert-bank.dto';
import { SubmitDriverOnboardingDto } from './dto/submit-onboarding.dto';
import { GeneratePaymentUploadUrlDto } from './dto/generate-payment-upload-url.dto';
import { CreateDriverPaymentMethodDto } from './dto/create-driver-payment-method.dto';
import { SetPreferredDriverPaymentMethodDto } from './dto/set-preferred-driver-payment-method.dto';

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

  @Get('payment-methods')
  paymentMethods(@Query('userId') userId: string) {
    return this.onboardingService.listPaymentMethods(userId);
  }

  @Post('payment-methods/upload-url')
  generatePaymentMethodUploadUrl(@Body() payload: GeneratePaymentUploadUrlDto) {
    return this.onboardingService.generatePaymentMethodUploadUrl(payload);
  }

  @Post('payment-methods')
  createPaymentMethod(@Body() payload: CreateDriverPaymentMethodDto) {
    return this.onboardingService.createPaymentMethod(payload);
  }

  @Post('payment-methods/:methodId/preferred')
  setPreferredPaymentMethod(
    @Param('methodId') methodId: string,
    @Body() payload: SetPreferredDriverPaymentMethodDto
  ) {
    return this.onboardingService.setPreferredPaymentMethod(payload.userId, methodId);
  }

  @Delete('payment-methods/:methodId')
  deletePaymentMethod(@Param('methodId') methodId: string, @Query('userId') userId: string) {
    return this.onboardingService.deletePaymentMethod(userId, methodId);
  }
}
