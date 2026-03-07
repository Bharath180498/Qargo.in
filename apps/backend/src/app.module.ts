import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TripsModule } from './modules/trips/trips.module';
import { DispatchModule } from './modules/dispatch/dispatch.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { InsuranceModule } from './modules/insurance/insurance.module';
import { EwayBillModule } from './modules/ewaybill/ewaybill.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { PricingModule } from './modules/pricing/pricing.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';
import { DriverOnboardingModule } from './modules/driver-onboarding/driver-onboarding.module';
import { KycModule } from './modules/kyc/kyc.module';
import { MapsModule } from './modules/maps/maps.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv
    }),
    PrismaModule,
    RedisModule,
    RealtimeModule,
    NotificationsModule,
    PricingModule,
    DispatchModule,
    InsuranceModule,
    EwayBillModule,
    PaymentsModule,
    UsersModule,
    AuthModule,
    DriversModule,
    DriverOnboardingModule,
    OrdersModule,
    TripsModule,
    KycModule,
    MapsModule,
    AdminModule,
    HealthModule
  ]
})
export class AppModule {}
