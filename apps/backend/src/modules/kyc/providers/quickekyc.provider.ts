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
export class QuickeKycProvider implements KycVerificationProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly fallback: MockIdfyProvider
  ) {}

  private get apiUrl() {
    return this.configService.get<string>('quickeKyc.apiUrl') ?? '';
  }

  private get apiKey() {
    return this.configService.get<string>('quickeKyc.apiKey') ?? '';
  }

  private get apiKeyHeader() {
    return this.configService.get<string>('quickeKyc.apiKeyHeader') ?? 'x-api-key';
  }

  private get useAuthorizationHeader() {
    return this.configService.get<boolean>('quickeKyc.useAuthorizationHeader') ?? false;
  }

  private buildUrl(path: string) {
    const base = this.apiUrl.replace(/\/$/, '');
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
  }

  private mapStatus(rawStatus: unknown) {
    const normalized = String(rawStatus ?? '').trim().toLowerCase();

    if (
      normalized.includes('verified') ||
      normalized.includes('approved') ||
      normalized.includes('success') ||
      normalized.includes('completed') ||
      normalized.includes('pass')
    ) {
      return KycVerificationStatus.VERIFIED;
    }

    if (
      normalized.includes('rejected') ||
      normalized.includes('failed') ||
      normalized.includes('declined') ||
      normalized.includes('mismatch') ||
      normalized.includes('invalid')
    ) {
      return KycVerificationStatus.REJECTED;
    }

    if (
      normalized.includes('pending') ||
      normalized.includes('review') ||
      normalized.includes('inconclusive') ||
      normalized.includes('manual')
    ) {
      return KycVerificationStatus.INCONCLUSIVE;
    }

    return KycVerificationStatus.INCONCLUSIVE;
  }

  private extractRiskSignals(payload: Record<string, unknown>) {
    const candidates = [
      payload.message,
      payload.reason,
      payload.error,
      (payload.result as Record<string, unknown> | undefined)?.message,
      (payload.result as Record<string, unknown> | undefined)?.reason
    ];

    const listSignals = [
      payload.riskSignals,
      payload.errors,
      payload.reasons,
      (payload.result as Record<string, unknown> | undefined)?.riskSignals,
      (payload.result as Record<string, unknown> | undefined)?.errors
    ];

    const scalarSignals = candidates
      .map((value) => String(value ?? '').trim())
      .filter((value) => Boolean(value));

    const arraySignals = listSignals
      .flatMap((value) => (Array.isArray(value) ? value : []))
      .map((value) => String(value ?? '').trim())
      .filter((value) => Boolean(value));

    return [...scalarSignals, ...arraySignals];
  }

  private isSuccessful(payload: Record<string, unknown>) {
    const status = String(payload.status ?? '').trim().toLowerCase();
    const statusCode = Number(payload.status_code ?? 0);

    return status === 'success' || statusCode === 200;
  }

  private async postRequest(path: string, body: Record<string, unknown>) {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // QuickeKYC docs show API key in payload as `key`; keep optional header fallback.
    if (this.apiKeyHeader) {
      headers[this.apiKeyHeader] = this.apiKey;
    }

    if (this.useAuthorizationHeader) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    const response = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...body,
        key: this.apiKey
      })
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

    return { response, payload };
  }

  async verify(input: VerifyKycInput): Promise<VerifyKycResult> {
    if (!this.apiKey || !this.apiUrl) {
      return this.fallback.verify(input);
    }

    try {
      const onboarding = input.onboarding ?? {};
      const checks: Array<{
        name: 'license' | 'rc' | 'bank';
        request: Promise<{ response: Response; payload: Record<string, unknown> }>;
      }> = [];

      if (onboarding.licenseNumber) {
        checks.push({
          name: 'license',
          request: this.postRequest('/driving-license/driving-license', {
            id_number: onboarding.licenseNumber,
            dob: onboarding.dateOfBirth ?? undefined
          })
        });
      }

      if (onboarding.rcNumber) {
        checks.push({
          name: 'rc',
          request: this.postRequest('/rc/rc-full', {
            id_number: onboarding.rcNumber
          })
        });
      }

      if (onboarding.accountNumber) {
        checks.push({
          name: 'bank',
          request: this.postRequest('/bank-verification/bank-verification', {
            id_number: onboarding.accountNumber,
            ifsc: onboarding.ifscCode ?? undefined
          })
        });
      }

      if (checks.length === 0) {
        return this.fallback.verify(input);
      }

      const results = await Promise.all(
        checks.map(async (check) => ({
          name: check.name,
          ...(await check.request)
        }))
      );
      const httpFailures = results.filter(({ response }) => !response.ok);
      if (httpFailures.length > 0) {
        const [first] = httpFailures;
        return {
          status: KycVerificationStatus.INCONCLUSIVE,
          providerRef: `quickekyc_http_${first.response.status}_${Date.now()}`,
          riskSignals: [
            `QuickeKYC request failed (${first.response.status})`,
            String(first.payload.message ?? first.payload.error ?? 'Unknown QuickeKYC error')
          ],
          providerResponse: {
            checks: results.map(({ payload }) => payload)
          }
        };
      }

      const unsuccessfulChecks = results.filter(({ payload }) => !this.isSuccessful(payload));
      const providerRefs = results
        .map(({ payload }) => String(payload.request_id ?? payload.id ?? ''))
        .filter((value) => Boolean(value));

      if (unsuccessfulChecks.length > 0) {
        const signals = unsuccessfulChecks.flatMap(({ payload }) => this.extractRiskSignals(payload));
        return {
          status: KycVerificationStatus.INCONCLUSIVE,
          providerRef: providerRefs.join(',') || `quickekyc_inconclusive_${Date.now()}`,
          riskSignals: signals.length > 0 ? signals : ['QuickeKYC returned non-success status'],
          providerResponse: {
            checks: results.map(({ payload }) => payload)
          }
        };
      }

      const accountCheck = results.find((result) => result.name === 'bank');
      const accountExists = accountCheck
        ? Boolean((accountCheck.payload.data as Record<string, unknown> | undefined)?.account_exists)
        : true;

      if (!accountExists) {
        return {
          status: KycVerificationStatus.REJECTED,
          providerRef: providerRefs.join(',') || `quickekyc_rejected_${Date.now()}`,
          riskSignals: ['Bank account verification failed (account does not exist)'],
          providerResponse: {
            checks: results.map(({ payload }) => payload)
          }
        };
      }

      const mergedSignals = results.flatMap(({ payload }) => this.extractRiskSignals(payload));

      return {
        status: KycVerificationStatus.VERIFIED,
        providerRef: providerRefs.join(',') || `quickekyc_${Date.now()}`,
        riskSignals: mergedSignals,
        providerResponse: {
          checks: results.map(({ name, payload }) => ({ name, ...payload }))
        }
      };
    } catch {
      return this.fallback.verify(input);
    }
  }
}
