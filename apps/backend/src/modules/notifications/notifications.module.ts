import { Global, Module } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { AuthModule } from '../auth/auth.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { FcmPushProvider } from './providers/fcm.provider';
import { MockPushProvider } from './providers/mock-push.provider';

@Global()
@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, MockPushProvider, ExpoPushProvider, FcmPushProvider, AdminAuthGuard],
  exports: [NotificationsService]
})
export class NotificationsModule {}
