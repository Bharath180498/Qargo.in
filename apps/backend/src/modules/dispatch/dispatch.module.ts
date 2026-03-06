import { Module } from '@nestjs/common';
import { DispatchService } from './dispatch.service';
import { DispatchController } from './dispatch.controller';
import { DriversModule } from '../drivers/drivers.module';
import { RouteEtaService } from './route-eta.service';

@Module({
  imports: [DriversModule],
  providers: [DispatchService, RouteEtaService],
  controllers: [DispatchController],
  exports: [DispatchService]
})
export class DispatchModule {}
