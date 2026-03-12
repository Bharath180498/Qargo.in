import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { KycModule } from '../kyc/kyc.module';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@Module({
  imports: [KycModule, AuthModule],
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService]
})
export class AdminModule {}
