import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RegisterCustomerPushTokenDto } from './dto/register-customer-push-token.dto';
import { RegisterPushTokenDto } from './dto/register-push-token.dto';
import { SendPushBroadcastDto } from './dto/send-push-broadcast.dto';
import { UnregisterCustomerPushTokenDto } from './dto/unregister-customer-push-token.dto';
import { UnregisterPushTokenDto } from './dto/unregister-push-token.dto';
import { ExpoPushProvider } from './providers/expo-push.provider';
import { FcmPushProvider } from './providers/fcm.provider';
import { MockPushProvider } from './providers/mock-push.provider';
import { PushProvider } from './providers/push.provider';

type PushRecipient = 'customer' | 'driver';

interface PushText {
  title: string;
  body: string;
}

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

  private get pushMode() {
    return (this.configService.get<string>('pushProvider') ?? 'mock').trim().toLowerCase();
  }

  private resolvePushProvider(token: string): PushProvider {
    if (this.pushMode === 'expo') {
      return this.expoPushProvider;
    }

    if (this.pushMode === 'fcm') {
      if (token.startsWith('ExponentPushToken[')) {
        return this.expoPushProvider;
      }
      return this.fcmPushProvider;
    }

    if (this.pushMode === 'mock') {
      return this.mockPushProvider;
    }

    if (token.startsWith('ExponentPushToken[')) {
      return this.expoPushProvider;
    }

    return this.mockPushProvider;
  }

  private parseNumber(value: unknown) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  private formatInr(value: number) {
    return `INR ${value.toFixed(2)}`;
  }

  private shouldDeactivateToken(error?: string) {
    if (!error) {
      return false;
    }

    return /(DeviceNotRegistered|NotRegistered|InvalidRegistration|UNREGISTERED|registration-token-not-registered)/i.test(
      error
    );
  }

  private buildPushText(recipient: PushRecipient, event: string, payload: Record<string, unknown>): PushText {
    if (event === 'broadcast') {
      const title = typeof payload.title === 'string' && payload.title.trim() ? payload.title.trim() : 'Qargo update';
      const body =
        typeof payload.body === 'string' && payload.body.trim()
          ? payload.body.trim()
          : 'You have a new update from QARGO.';
      return { title, body };
    }

    if (recipient === 'driver') {
      switch (event) {
        case 'trip_offer_new': {
          const etaMinutes = this.parseNumber(payload.routeEtaMinutes);
          return {
            title: 'New trip request',
            body: etaMinutes !== null ? `Pickup is about ${Math.round(etaMinutes)} min away. Tap to accept.` : 'Tap to review and accept this trip.'
          };
        }
        case 'next_job_offer':
          return {
            title: 'Next job queued',
            body: 'You have a queued job waiting. Open the app to review.'
          };
        case 'trip_cancelled_by_customer':
          return {
            title: 'Trip cancelled',
            body: 'Customer cancelled this trip before completion.'
          };
        case 'waiting_charge_triggered': {
          const waitingCharge = this.parseNumber(payload.waitingCharge);
          const waitingMinutes = this.parseNumber(payload.waitingMinutes);
          return {
            title: 'Waiting charge updated',
            body:
              waitingCharge !== null
                ? `${this.formatInr(waitingCharge)} added${waitingMinutes !== null ? ` after ${Math.round(waitingMinutes)} min wait` : ''}.`
                : 'Waiting charge has been added to this trip.'
          };
        }
        case 'trip_completed': {
          const nextJobActivated = Boolean(payload.nextJobActivated);
          return {
            title: 'Trip completed',
            body: nextJobActivated
              ? 'Delivery completed. Next queued job is now active.'
              : 'Delivery completed successfully.'
          };
        }
        case 'sos_triggered':
          return {
            title: 'SOS alert active',
            body: 'Emergency flow triggered for this trip. Open app now.'
          };
        default:
          return {
            title: 'Driver update',
            body: event.replace(/_/g, ' ')
          };
      }
    }

    switch (event) {
      case 'driver_assigned': {
        const etaMinutes = this.parseNumber(payload.etaMinutes);
        return {
          title: 'Driver assigned',
          body:
            etaMinutes !== null
              ? `Your driver is on the way. ETA ${Math.max(1, Math.round(etaMinutes))} min.`
              : 'Your driver is on the way.'
        };
      }
      case 'driver_en_route':
        return {
          title: 'Driver heading to pickup',
          body: 'Your driver has started and is heading to your pickup point.'
        };
      case 'driver_arrived_pickup':
        return {
          title: 'Driver has arrived',
          body: 'Your driver is at pickup. Please proceed with loading.'
        };
      case 'waiting_charge_triggered': {
        const waitingCharge = this.parseNumber(payload.waitingCharge);
        return {
          title: 'Waiting charge applied',
          body:
            waitingCharge !== null
              ? `${this.formatInr(waitingCharge)} waiting charge added to your trip.`
              : 'A waiting charge has been added to your trip.'
        };
      }
      case 'delivery_completed': {
        const receiverName =
          typeof payload.receiverName === 'string' && payload.receiverName.trim() ? payload.receiverName.trim() : '';
        return {
          title: 'Delivery completed',
          body: receiverName ? `Delivery confirmed by ${receiverName}.` : 'Your delivery has been completed.'
        };
      }
      case 'sos_triggered':
        return {
          title: 'Trip safety alert',
          body: 'An SOS alert was triggered for this trip. Support has been notified.'
        };
      default:
        return {
          title: 'Trip update',
          body: event.replace(/_/g, ' ')
        };
    }
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

  async registerCustomerToken(payload: RegisterCustomerPushTokenDto) {
    return this.prisma.customerPushToken.upsert({
      where: { token: payload.token },
      update: {
        customerId: payload.customerId,
        platform: payload.platform,
        appVersion: payload.appVersion,
        deviceId: payload.deviceId,
        isActive: true,
        lastSeenAt: new Date()
      },
      create: {
        customerId: payload.customerId,
        token: payload.token,
        platform: payload.platform,
        appVersion: payload.appVersion,
        deviceId: payload.deviceId,
        isActive: true,
        lastSeenAt: new Date()
      }
    });
  }

  async unregisterCustomerToken(payload: UnregisterCustomerPushTokenDto) {
    await this.prisma.customerPushToken.updateMany({
      where: {
        customerId: payload.customerId,
        token: payload.token
      },
      data: {
        isActive: false
      }
    });

    return { success: true };
  }

  private async pushEvent(input: {
    recipient: PushRecipient;
    recipientId: string;
    event: string;
    payload: Record<string, unknown>;
    tokens: Array<{ id: string; token: string }>;
    deactivateToken: (tokenId: string) => Promise<void>;
  }) {
    if (input.tokens.length === 0) {
      return [];
    }

    const pushText = this.buildPushText(input.recipient, input.event, input.payload);
    const sends = await Promise.all(
      input.tokens.map(async (tokenEntry) => {
        const provider = this.resolvePushProvider(tokenEntry.token);
        const result = await provider.send({
          token: tokenEntry.token,
          title: pushText.title,
          body: pushText.body,
          data: {
            recipient: input.recipient,
            event: input.event,
            ...input.payload
          }
        });

        if (!result.success) {
          const reason = result.error ?? 'unknown';
          this.logger.warn(
            `Push failure recipient=${input.recipient} id=${input.recipientId} token=${tokenEntry.id} event=${input.event} reason=${reason}`
          );
          if (this.shouldDeactivateToken(result.error)) {
            await input.deactivateToken(tokenEntry.id);
          }
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

    const tokens = await this.prisma.customerPushToken.findMany({
      where: {
        customerId,
        isActive: true
      },
      select: {
        id: true,
        token: true
      }
    });

    const pushResults = await this.pushEvent({
      recipient: 'customer',
      recipientId: customerId,
      event,
      payload,
      tokens,
      deactivateToken: async (tokenId: string) => {
        await this.prisma.customerPushToken.update({
          where: { id: tokenId },
          data: { isActive: false }
        });
      }
    });

    return {
      delivered: true,
      pushAttempts: pushResults.length
    };
  }

  async notifyDriver(driverId: string, event: string, payload: Record<string, unknown>) {
    this.logger.log(`Notify driver ${driverId}: ${event} ${JSON.stringify(payload)}`);

    const tokens = await this.prisma.driverPushToken.findMany({
      where: {
        driverId,
        isActive: true
      },
      select: {
        id: true,
        token: true
      }
    });

    const pushResults = await this.pushEvent({
      recipient: 'driver',
      recipientId: driverId,
      event,
      payload,
      tokens,
      deactivateToken: async (tokenId: string) => {
        await this.prisma.driverPushToken.update({
          where: { id: tokenId },
          data: { isActive: false }
        });
      }
    });

    return {
      delivered: true,
      pushAttempts: pushResults.length
    };
  }

  async sendBroadcast(payload: SendPushBroadcastDto) {
    const recipient = payload.recipient;
    const maxRecipients = payload.maxRecipients ?? 1000;
    const safeData = payload.data && typeof payload.data === 'object' ? payload.data : {};

    const [customerTokens, driverTokens] = await Promise.all([
      recipient === 'driver'
        ? Promise.resolve([])
        : this.prisma.customerPushToken.findMany({
            where: { isActive: true },
            orderBy: { lastSeenAt: 'desc' },
            take: recipient === 'all' ? Math.ceil(maxRecipients / 2) : maxRecipients,
            select: { id: true, token: true, customerId: true }
          }),
      recipient === 'customer'
        ? Promise.resolve([])
        : this.prisma.driverPushToken.findMany({
            where: { isActive: true },
            orderBy: { lastSeenAt: 'desc' },
            take: recipient === 'all' ? Math.floor(maxRecipients / 2) : maxRecipients,
            select: { id: true, token: true, driverId: true }
          })
    ]);

    const customerEvents = await this.pushEvent({
      recipient: 'customer',
      recipientId: 'broadcast',
      event: 'broadcast',
      payload: {
        title: payload.title,
        body: payload.body,
        campaignData: safeData
      },
      tokens: customerTokens.map((entry) => ({ id: entry.id, token: entry.token })),
      deactivateToken: async (tokenId: string) => {
        await this.prisma.customerPushToken.update({
          where: { id: tokenId },
          data: { isActive: false }
        });
      }
    });

    const driverEvents = await this.pushEvent({
      recipient: 'driver',
      recipientId: 'broadcast',
      event: 'broadcast',
      payload: {
        title: payload.title,
        body: payload.body,
        campaignData: safeData
      },
      tokens: driverTokens.map((entry) => ({ id: entry.id, token: entry.token })),
      deactivateToken: async (tokenId: string) => {
        await this.prisma.driverPushToken.update({
          where: { id: tokenId },
          data: { isActive: false }
        });
      }
    });

    return {
      recipient,
      attempted: customerEvents.length + driverEvents.length,
      customerAttempts: customerEvents.length,
      driverAttempts: driverEvents.length,
      title: payload.title
    };
  }
}
