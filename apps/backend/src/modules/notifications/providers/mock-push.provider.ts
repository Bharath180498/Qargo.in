import { Injectable, Logger } from '@nestjs/common';
import { PushMessageInput, PushProvider } from './push.provider';

@Injectable()
export class MockPushProvider implements PushProvider {
  private readonly logger = new Logger(MockPushProvider.name);

  async send(message: PushMessageInput) {
    this.logger.log(`Push(mock) ${message.token}: ${message.title} | ${message.body}`);
    return {
      success: true,
      providerRef: `mock_${Date.now()}`
    };
  }
}

