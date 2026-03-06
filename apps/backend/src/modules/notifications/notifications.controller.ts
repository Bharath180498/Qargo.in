import { Body, Controller, Post } from '@nestjs/common';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications/tokens')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register')
  register(@Body() payload: RegisterPushTokenDto) {
    return this.notificationsService.registerDriverToken(payload);
  }

  @Post('unregister')
  unregister(@Body() payload: UnregisterPushTokenDto) {
    return this.notificationsService.unregisterDriverToken(payload);
  }
}

