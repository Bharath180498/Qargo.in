import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  KycVerificationProvider,
  VerifyKycInput,
  VerifyKycResult
} from './kyc-verification.provider';
import { MockIdfyProvider } from './mock-idfy.provider';

@Injectable()
export class IdfyProvider implements KycVerificationProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly fallback: MockIdfyProvider
  ) {}

  async verify(input: VerifyKycInput): Promise<VerifyKycResult> {
    const key = this.configService.get<string>('idfyApiKey') ?? '';

    // Without credentials we transparently use fallback logic.
    if (!key) {
      return this.fallback.verify(input);
    }

    // Placeholder for live API integration wiring.
    return this.fallback.verify(input);
  }
}

