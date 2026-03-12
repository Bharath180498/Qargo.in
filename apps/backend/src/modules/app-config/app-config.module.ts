import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';

@Module({
  imports: [AuthModule],
  controllers: [AppConfigController],
  providers: [AppConfigService, AdminAuthGuard]
})
export class AppConfigModule {}
