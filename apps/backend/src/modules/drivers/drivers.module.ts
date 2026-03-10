import { Module } from '@nestjs/common';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';
import { AuthModule } from '../auth/auth.module';
import { AdminAuthGuard } from '../../common/guards/admin-auth.guard';

@Module({
  imports: [AuthModule],
  providers: [DriversService, AdminAuthGuard],
  controllers: [DriversController],
  exports: [DriversService]
})
export class DriversModule {}
