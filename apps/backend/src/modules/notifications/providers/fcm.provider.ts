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

    return this.fallback.send(message);
  }
}

