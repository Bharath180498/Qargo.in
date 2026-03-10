import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@Module({
  imports: [AuthModule],
  providers: [PricingService, AdminAuthGuard],
  exports: [PricingService],
  controllers: [PricingController]
})
export class PricingModule {}
