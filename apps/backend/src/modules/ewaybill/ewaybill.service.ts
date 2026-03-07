import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GenerateEwayBillDto } from './dto/generate-ewaybill.dto';

@Injectable()
export class EwayBillService {
  constructor(private readonly configService: ConfigService) {}

  private get apiUrl() {
    return this.configService.get<string>('ewayBillApiUrl') ?? '';
  }

  private get apiKey() {
    return this.configService.get<string>('ewayBillApiKey') ?? '';
  }

  private generateMock(payload: GenerateEwayBillDto) {
    if (!/^\d{15}$/.test(payload.gstin)) {
      throw new BadRequestException('Invalid GSTIN format');
    }

    const ewayBillNumber = `EWB${Date.now()}${Math.floor(Math.random() * 10_000)}`;

    return {
      ewayBillNumber,
      validTill: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      status: 'GENERATED',
      provider: 'mock',
      payload
    };
  }

  async generate(payload: GenerateEwayBillDto) {
    if (!this.apiUrl || this.apiUrl === 'replace-me' || this.apiUrl.includes('sandbox.ewaybill.example')) {
      return this.generateMock(payload);
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
        return this.generateMock(payload);
      }

      const external = (await response.json().catch(() => null)) as
        | Record<string, unknown>
        | null;

      if (!external || typeof external !== 'object') {
        return this.generateMock(payload);
      }

      return {
        provider: 'external',
        ...external
      };
    } catch {
      return this.generateMock(payload);
    }
  }
}
