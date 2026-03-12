import { Body, Controller, Post } from '@nestjs/common';
import { UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';
import { RegisterCustomerPushTokenDto } from './dto/register-customer-push-token.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { SendPushBroadcastDto } from './dto/send-push-broadcast.dto';
import { UnregisterCustomerPushTokenDto } from './dto/unregister-customer-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications/tokens')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('driver/register')
  registerDriver(@Body() payload: RegisterPushTokenDto) {
    return this.notificationsService.registerDriverToken(payload);
  }

  @Post('driver/unregister')
  unregisterDriver(@Body() payload: UnregisterPushTokenDto) {
    return this.notificationsService.unregisterDriverToken(payload);
  }

  @Post('customer/register')
  registerCustomer(@Body() payload: RegisterCustomerPushTokenDto) {
    return this.notificationsService.registerCustomerToken(payload);
  }

  @Post('customer/unregister')
  unregisterCustomer(@Body() payload: UnregisterCustomerPushTokenDto) {
    return this.notificationsService.unregisterCustomerToken(payload);
  }

  // Backward compatibility for older driver builds.
  @Post('register')
  registerDriverLegacy(@Body() payload: RegisterPushTokenDto) {
    return this.notificationsService.registerDriverToken(payload);
  }

  // Backward compatibility for older driver builds.
  @Post('unregister')
  unregisterDriverLegacy(@Body() payload: UnregisterPushTokenDto) {
    return this.notificationsService.unregisterDriverToken(payload);
  }

  @UseGuards(AdminAuthGuard)
  @Post('broadcast')
  broadcast(@Body() payload: SendPushBroadcastDto) {
    return this.notificationsService.sendBroadcast(payload);
  }
}
