import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InsurancePlan } from '@prisma/client';
import { QuoteInsuranceDto } from './dto/quote-insurance.dto';

@Injectable()
export class InsuranceService {
  constructor(private readonly configService: ConfigService) {}

  private get apiUrl() {
    return this.configService.get<string>('insuranceApiUrl') ?? '';
  }

  private get apiKey() {
    return this.configService.get<string>('insuranceApiKey') ?? '';
  }

  private quoteMock(payload: QuoteInsuranceDto) {
    const goodsValue = payload.goodsValue;

    const options = [
      {
        plan: InsurancePlan.BASIC,
        premium: Number((goodsValue * 0.008).toFixed(2)),
        coverage: goodsValue,
        deductible: Number((goodsValue * 0.05).toFixed(2))
      },
      {
        plan: InsurancePlan.PREMIUM,
        premium: Number((goodsValue * 0.012).toFixed(2)),
        coverage: Number((goodsValue * 1.1).toFixed(2)),
        deductible: Number((goodsValue * 0.03).toFixed(2))
      },
      {
        plan: InsurancePlan.HIGH_VALUE,
        premium: Number((goodsValue * 0.018).toFixed(2)),
        coverage: Number((goodsValue * 1.3).toFixed(2)),
        deductible: Number((goodsValue * 0.02).toFixed(2))
      }
    ];

    return {
      goodsType: payload.goodsType,
      goodsValue,
      currency: 'INR',
      provider: 'mock',
      options
    };
  }

  async quote(payload: QuoteInsuranceDto) {
    if (!this.apiUrl || this.apiUrl === 'replace-me') {
      return this.quoteMock(payload);
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {})
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        return this.quoteMock(payload);
      }

      const external = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;

      if (!external || typeof external !== 'object') {
        return this.quoteMock(payload);
      }

      return {
        provider: 'external',
        ...external
      };
    } catch {
      return this.quoteMock(payload);
    }
  }
}
