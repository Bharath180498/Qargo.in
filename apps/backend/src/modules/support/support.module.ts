import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { SupportController } from './support.controller';
import { SupportAdminController } from './support-admin.controller';
import { SupportService } from './support.service';

@Module({
  imports: [AuthModule],
  controllers: [SupportController, SupportAdminController],
  providers: [SupportService, AdminAuthGuard],
  exports: [SupportService]
})
export class SupportModule {}
