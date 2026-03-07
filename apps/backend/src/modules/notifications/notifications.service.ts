import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { FcmPushProvider } from './providers/fcm.provider';
import { MockPushProvider } from './providers/mock-push.provider';
import { PushProvider } from './providers/push.provider';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly mockPushProvider: MockPushProvider,
    private readonly expoPushProvider: ExpoPushProvider,
    private readonly fcmPushProvider: FcmPushProvider
  ) {}

  private get defaultPushProvider(): PushProvider {
    const mode = this.configService.get<string>('pushProvider') ?? 'mock';
    if (mode === 'fcm') {
      return this.fcmPushProvider;
    }
    return this.mockPushProvider;
  }

  async registerDriverToken(payload: RegisterPushTokenDto) {
    return this.prisma.driverPushToken.upsert({
      where: { token: payload.token },
      update: {
        driverId: payload.driverId,
        platform: payload.platform,
        appVersion: payload.appVersion,
        deviceId: payload.deviceId,
        isActive: true,
        lastSeenAt: new Date()
      },
      create: {
        driverId: payload.driverId,
        token: payload.token,
        platform: payload.platform,
        appVersion: payload.appVersion,
        deviceId: payload.deviceId,
        isActive: true,
        lastSeenAt: new Date()
      }
    });
  }

  async unregisterDriverToken(payload: UnregisterPushTokenDto) {
    await this.prisma.driverPushToken.updateMany({
      where: {
        driverId: payload.driverId,
        token: payload.token
      },
      data: {
        isActive: false
      }
    });

    return { success: true };
  }

  private async pushDriverEvent(driverId: string, event: string, payload: Record<string, unknown>) {
    const tokens = await this.prisma.driverPushToken.findMany({
      where: {
        driverId,
        isActive: true
      }
    });

    if (tokens.length === 0) {
      return [];
    }

    const title = 'Qargo';
    const body = `New update: ${event.replace(/_/g, ' ')}`;
    const sends = await Promise.all(
      tokens.map(async (tokenEntry) => {
        const provider = tokenEntry.token.startsWith('ExponentPushToken[')
          ? this.expoPushProvider
          : this.defaultPushProvider;

        const result = await provider.send({
          token: tokenEntry.token,
          title,
          body,
          data: {
            event,
            ...payload
          }
        });

        if (!result.success) {
          this.logger.warn(
            `Push failure driver=${driverId} token=${tokenEntry.id} event=${event} reason=${result.error ?? 'unknown'}`
          );
        }

        return {
          tokenId: tokenEntry.id,
          ...result
        };
      })
    );

    return sends;
  }

  async notifyCustomer(customerId: string, event: string, payload: Record<string, unknown>) {
    this.logger.log(`Notify customer ${customerId}: ${event} ${JSON.stringify(payload)}`);
  }

  async notifyDriver(driverId: string, event: string, payload: Record<string, unknown>) {
    this.logger.log(`Notify driver ${driverId}: ${event} ${JSON.stringify(payload)}`);
    const pushResults = await this.pushDriverEvent(driverId, event, payload);

    return {
      delivered: true,
      pushAttempts: pushResults.length
    };
  }
}
