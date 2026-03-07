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
export class CashfreeProvider implements KycVerificationProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly fallback: MockIdfyProvider
  ) {}

  private get clientId() {
    return this.configService.get<string>('cashfree.clientId') ?? '';
  }

  private get clientSecret() {
    return this.configService.get<string>('cashfree.clientSecret') ?? '';
  }

  private get apiUrl() {
    return this.configService.get<string>('cashfree.kycApiUrl') ?? '';
  }

  private get apiVersion() {
    return this.configService.get<string>('cashfree.apiVersion') ?? '2023-08-01';
  }

  private mapStatus(rawStatus: unknown) {
    const normalized = String(rawStatus ?? '').trim().toLowerCase();

    if (
      normalized.includes('verified') ||
      normalized.includes('approved') ||
      normalized.includes('success') ||
      normalized.includes('completed')
    ) {
      return KycVerificationStatus.VERIFIED;
    }

    if (
      normalized.includes('rejected') ||
      normalized.includes('failed') ||
      normalized.includes('declined') ||
      normalized.includes('mismatch')
    ) {
      return KycVerificationStatus.REJECTED;
    }

    if (
      normalized.includes('pending') ||
      normalized.includes('review') ||
      normalized.includes('inconclusive')
    ) {
      return KycVerificationStatus.INCONCLUSIVE;
    }

    return KycVerificationStatus.INCONCLUSIVE;
  }

  private extractRiskSignals(payload: Record<string, unknown>) {
    const signals: string[] = [];

    const reasons = payload.reasons;
    if (Array.isArray(reasons)) {
      reasons.forEach((value) => signals.push(String(value)));
    }

    const errors = payload.errors;
    if (Array.isArray(errors)) {
      errors.forEach((value) => signals.push(String(value)));
    }

    if (typeof payload.message === 'string' && payload.message.trim()) {
      signals.push(payload.message);
    }

    return signals.filter((value) => Boolean(value.trim()));
  }

  async verify(input: VerifyKycInput): Promise<VerifyKycResult> {
    if (!this.clientId || !this.clientSecret || !this.apiUrl) {
      return this.fallback.verify(input);
    }

    try {
      const payloadBody = {
        reference_id: `qargo_kyc_${input.userId}_${Date.now()}`,
        user_id: input.userId,
        documents: input.documents.map((doc) => ({
          type: doc.type,
          file_url: doc.fileUrl
        }))
      };

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.clientId,
          'x-client-secret': this.clientSecret,
          'x-api-version': this.apiVersion
        },
        body: JSON.stringify(payloadBody)
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        return {
          status: KycVerificationStatus.INCONCLUSIVE,
          providerRef: `cashfree_http_${response.status}_${Date.now()}`,
          riskSignals: [
            `Cashfree request failed (${response.status})`,
            String(payload.message ?? 'Unknown Cashfree error')
          ],
          providerResponse: payload
        };
      }

      const nested = payload.result as Record<string, unknown> | undefined;
      const status =
        this.mapStatus(payload.status) ??
        this.mapStatus(payload.verification_status) ??
        this.mapStatus(payload.kyc_status) ??
        this.mapStatus(nested?.status);

      const providerRef = String(
        payload.reference_id ?? payload.cf_reference_id ?? payload.id ?? `cashfree_${Date.now()}`
      );

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
