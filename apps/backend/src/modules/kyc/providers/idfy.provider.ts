import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KycVerificationStatus } from '@prisma/client';
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

  private get apiKey() {
    return this.configService.get<string>('idfyApiKey') ?? '';
  }

  private get apiUrl() {
    return this.configService.get<string>('idfyApiUrl') ?? '';
  }

  private get accountId() {
    return this.configService.get<string>('idfyAccountId') ?? '';
  }

  private mapStatus(rawStatus: unknown) {
    const normalized = String(rawStatus ?? '').trim().toLowerCase();

    if (
      normalized.includes('verified') ||
      normalized.includes('success') ||
      normalized.includes('completed') ||
      normalized.includes('pass')
    ) {
      return KycVerificationStatus.VERIFIED;
    }

    if (
      normalized.includes('reject') ||
      normalized.includes('failed') ||
      normalized.includes('fail') ||
      normalized.includes('mismatch')
    ) {
      return KycVerificationStatus.REJECTED;
    }

    if (
      normalized.includes('inconclusive') ||
      normalized.includes('review') ||
      normalized.includes('pending')
    ) {
      return KycVerificationStatus.INCONCLUSIVE;
    }

    return KycVerificationStatus.INCONCLUSIVE;
  }

  private extractRiskSignals(payload: Record<string, unknown>) {
    const primary = payload?.riskSignals;
    if (Array.isArray(primary)) {
      return primary
        .map((entry) => String(entry))
        .filter((entry) => Boolean(entry.trim()));
    }

    const secondary = (payload?.result as { risk_signals?: unknown } | undefined)?.risk_signals;
    if (Array.isArray(secondary)) {
      return secondary
        .map((entry) => String(entry))
        .filter((entry) => Boolean(entry.trim()));
    }

    return [];
  }

  async verify(input: VerifyKycInput): Promise<VerifyKycResult> {
    // Without credentials we transparently use fallback logic.
    if (!this.apiKey || !this.apiUrl) {
      return this.fallback.verify(input);
    }

    try {
      const body = {
        task_id: `qargo_kyc_${Date.now()}`,
        group_id: `qargo_user_${input.userId}`,
        data: {
          user_id: input.userId,
          documents: input.documents.map((doc) => ({
            type: doc.type,
            file_url: doc.fileUrl
          }))
        }
      };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      };

      if (this.accountId) {
        headers['account-id'] = this.accountId;
      }

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        return {
          status: KycVerificationStatus.INCONCLUSIVE,
          providerRef: `idfy_http_${response.status}_${Date.now()}`,
          riskSignals: [
            `IDfy request failed (${response.status})`,
            String(payload?.message ?? 'Unknown IDfy error')
          ],
          providerResponse: payload
        };
      }

      const status =
        this.mapStatus(payload.status) ??
        this.mapStatus((payload.result as { status?: unknown } | undefined)?.status);

      const providerRef =
        String(payload.request_id ?? payload.id ?? payload.task_id ?? `idfy_${Date.now()}`);

      return {
        status,
        providerRef,
        riskSignals: this.extractRiskSignals(payload),
        providerResponse: payload
      };
    } catch {
      return this.fallback.verify(input);
    }
  }
}
