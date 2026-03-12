import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AppConfigService } from './app-config.service';
import { UpdateMobileHomeContentDto } from './dto/update-mobile-home-content.dto';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('mobile-home')
  getMobileHomeContent() {
    return this.appConfigService.getMobileHomeContent();
  }

  @UseGuards(AdminAuthGuard)
  @Put('mobile-home')
  updateMobileHomeContent(@Body() payload: UpdateMobileHomeContentDto) {
    return this.appConfigService.updateMobileHomeContent(payload);
  }
}
