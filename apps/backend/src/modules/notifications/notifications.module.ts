import { Global, Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { FcmPushProvider } from './providers/fcm.provider';
import { MockPushProvider } from './providers/mock-push.provider';

@Global()
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService, MockPushProvider, ExpoPushProvider, FcmPushProvider],
  exports: [NotificationsService]
})
export class NotificationsModule {}
