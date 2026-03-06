import { KycDocType, KycVerificationStatus } from '@prisma/client';

export interface VerifyKycInput {
  userId: string;
  documents: Array<{
    type: KycDocType;
    fileUrl: string;
  }>;
}

export interface VerifyKycResult {
  status: KycVerificationStatus;
  providerRef: string;
  riskSignals: string[];
  providerResponse: Record<string, unknown>;
}

export interface KycVerificationProvider {
  verify(input: VerifyKycInput): Promise<VerifyKycResult>;
}

