import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PushMessageInput, PushProvider } from './push.provider';
import { MockPushProvider } from './mock-push.provider';

@Injectable()
export class FcmPushProvider implements PushProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly fallback: MockPushProvider
  ) {}

  async send(message: PushMessageInput) {
    const serverKey = this.configService.get<string>('fcmServerKey') ?? '';

    // Fallback while credentials are not configured.
    if (!serverKey) {
      return this.fallback.send(message);
    }

    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          Authorization: `key=${serverKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: message.token,
          notification: {
            title: message.title,
            body: message.body
          },
          data: message.data ?? {}
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: number;
        failure?: number;
        results?: Array<{ error?: string }>;
      };

      if (!response.ok || payload.failure) {
        return {
          success: false,
          provider: 'fcm',
          error:
            payload.results?.[0]?.error ??
            `FCM send failed (${response.status})`
        };
      }

      return {
        success: true,
        provider: 'fcm'
      };
    } catch {
      return this.fallback.send(message);
    }
  }
}
