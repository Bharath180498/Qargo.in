import { Injectable } from '@nestjs/common';
import { PushMessageInput, PushProvider } from './push.provider';

@Injectable()
export class ExpoPushProvider implements PushProvider {
  async send(message: PushMessageInput) {
    if (!message.token.startsWith('ExponentPushToken[')) {
      return {
        success: false,
        error: 'Unsupported token format for Expo provider'
      };
    }

    try {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          to: message.token,
          title: message.title,
          body: message.body,
          data: message.data ?? {}
        })
      });

      if (!response.ok) {
        return {
          success: false,
          error: `Expo push returned ${response.status}`
        };
      }

      const json = (await response.json().catch(() => ({}))) as {
        data?:
          | {
              status?: 'ok' | 'error';
              id?: string;
              message?: string;
              details?: { error?: string };
            }
          | Array<{
              status?: 'ok' | 'error';
              id?: string;
              message?: string;
              details?: { error?: string };
            }>;
      };

      const payload = Array.isArray(json.data) ? json.data[0] : json.data;
      if (payload?.status === 'error') {
        return {
          success: false,
          error: payload.details?.error ?? payload.message ?? 'Expo push error'
        };
      }

      return {
        success: true,
        providerRef: payload?.id
      };
    } catch (error: unknown) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to send expo push'
      };
    }
  }
}
