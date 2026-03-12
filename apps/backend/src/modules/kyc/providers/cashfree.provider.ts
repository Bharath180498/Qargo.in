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
      normalized === 'valid' ||
      normalized.includes('verified') ||
      normalized.includes('approved') ||
      normalized.includes('success') ||
      normalized.includes('completed') ||
      normalized.includes('pass') ||
      normalized.includes('good_match')
    ) {
      return KycVerificationStatus.VERIFIED;
    }

    if (
      normalized === 'invalid' ||
      normalized === 'blocked' ||
      normalized.includes('rejected') ||
      normalized.includes('failed') ||
      normalized.includes('declined') ||
      normalized.includes('mismatch') ||
      normalized.includes('not_match')
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

  private buildUrl(path: string) {
    const base = this.apiUrl.trim().replace(/\/$/, '');
    if (!base) {
      return '';
    }

    // Allow passing complete endpoint as CASHFREE_KYC_API_URL for backward compatibility.
    if (/\/(driving-license|vehicle-rc|bank-account)(\/|$)/i.test(base)) {
      return base;
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${normalizedPath}`;
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
    if (typeof payload.account_status_code === 'string' && payload.account_status_code.trim()) {
      signals.push(payload.account_status_code);
    }
    if (typeof payload.error_message === 'string' && payload.error_message.trim()) {
      signals.push(payload.error_message);
    }

    return signals.filter((value) => Boolean(value.trim()));
  }

  private verificationStatusFromPayload(payload: Record<string, unknown>) {
    return (
      this.mapStatus(payload.status) ??
      this.mapStatus(payload.account_status) ??
      this.mapStatus(payload.verification_status) ??
      this.mapStatus(payload.kyc_status)
    );
  }

  private async postRequest(path: string, body: Record<string, unknown>) {
    const response = await fetch(this.buildUrl(path), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': this.clientId,
        'x-client-secret': this.clientSecret,
        'x-api-version': this.apiVersion
      },
      body: JSON.stringify(body)
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    return { response, payload };
  }

  private async verifyLegacy(input: VerifyKycInput): Promise<VerifyKycResult> {
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
  }

  async verify(input: VerifyKycInput): Promise<VerifyKycResult> {
    if (!this.clientId || !this.clientSecret || !this.apiUrl) {
      return this.fallback.verify(input);
    }

    try {
      // If endpoint already points to a specific API path, keep old behavior.
      if (/\/(driving-license|vehicle-rc|bank-account)(\/|$)/i.test(this.apiUrl)) {
        return this.verifyLegacy(input);
      }

      const onboarding = input.onboarding ?? {};
      const checks: Array<{
        name: 'vehicle_rc' | 'driving_license' | 'bank_account';
        request: Promise<{ response: Response; payload: Record<string, unknown> }>;
      }> = [];

      if (onboarding.rcNumber?.trim()) {
        checks.push({
          name: 'vehicle_rc',
          request: this.postRequest('/vehicle-rc', {
            verification_id: `qargo_rc_${input.userId}_${Date.now()}`,
            vehicle_number: onboarding.rcNumber.trim().toUpperCase()
          })
        });
      }

      // Cashfree DL verification typically needs DL number + DOB.
      if (onboarding.licenseNumber?.trim() && onboarding.dateOfBirth?.trim()) {
        checks.push({
          name: 'driving_license',
          request: this.postRequest('/driving-license', {
            verification_id: `qargo_dl_${input.userId}_${Date.now()}`,
            dl_number: onboarding.licenseNumber.trim().toUpperCase(),
            dob: onboarding.dateOfBirth.trim()
          })
        });
      }

      if (onboarding.accountNumber?.trim() && onboarding.ifscCode?.trim()) {
        checks.push({
          name: 'bank_account',
          request: this.postRequest('/bank-account/sync', {
            bank_account: onboarding.accountNumber.trim(),
            ifsc: onboarding.ifscCode.trim().toUpperCase(),
            name: onboarding.fullName?.trim() || undefined,
            phone: onboarding.phone?.trim() || undefined
          })
        });
      }

      if (checks.length === 0) {
        return this.verifyLegacy(input);
      }

      const results = await Promise.all(
        checks.map(async (check) => ({
          name: check.name,
          ...(await check.request)
        }))
      );

      const httpFailures = results.filter(({ response }) => !response.ok);
      if (httpFailures.length > 0) {
        const firstFailure = httpFailures[0];
        return {
          status: KycVerificationStatus.INCONCLUSIVE,
          providerRef: `cashfree_http_${firstFailure.response.status}_${Date.now()}`,
          riskSignals: [
            `Cashfree request failed (${firstFailure.response.status})`,
            String(firstFailure.payload.message ?? firstFailure.payload.error_message ?? 'Unknown Cashfree error')
          ],
          providerResponse: {
            checks: results.map(({ name, payload }) => ({ name, ...payload }))
          }
        };
      }

      const statuses = results.map(({ payload }) => this.verificationStatusFromPayload(payload));
      const hasRejected = statuses.some((status) => status === KycVerificationStatus.REJECTED);
      const allVerified = statuses.every((status) => status === KycVerificationStatus.VERIFIED);

      const status = hasRejected
        ? KycVerificationStatus.REJECTED
        : allVerified
          ? KycVerificationStatus.VERIFIED
          : KycVerificationStatus.INCONCLUSIVE;

      const providerRef = results
        .map(({ payload }) => String(payload.verification_id ?? payload.reference_id ?? payload.id ?? '').trim())
        .filter((value) => Boolean(value))
        .join(',') || `cashfree_${Date.now()}`;

      const riskSignals = results.flatMap(({ payload }) => this.extractRiskSignals(payload));

      return {
        status,
        providerRef,
        riskSignals,
        providerResponse: {
          checks: results.map(({ name, payload }) => ({ name, ...payload }))
        }
      };
    } catch {
      return this.fallback.verify(input);
    }
  }
}
