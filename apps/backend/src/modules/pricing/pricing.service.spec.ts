import { InsurancePlan, VehicleType } from '@prisma/client';
import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const pricingRuleFindFirst = jest.fn();
  const configGet = jest.fn();

  const service = new PricingService({
    pricingRule: {
      findFirst: pricingRuleFindFirst
    }
  } as any, {
    get: configGet
  } as any);

  beforeEach(() => {
    pricingRuleFindFirst.mockReset();
    configGet.mockReset();
    configGet.mockImplementation((key: string) => {
      if (key === 'baseFarePerKm') {
        return 14;
      }
      if (key === 'alwaysOnDiscountPercent') {
        return 8;
      }
      return undefined;
    });
  });

  it('returns fallback rating multiplier when no custom rule exists', async () => {
    pricingRuleFindFirst.mockResolvedValue(null);

    const multiplier = await service.getRatingMultiplier(4.3);

    expect(multiplier).toBe(0.92);
  });

  it('calculates insurance premium by selected plan', () => {
    expect(service.calculateInsurancePremium(InsurancePlan.NONE, 100000)).toBe(0);
    expect(service.calculateInsurancePremium(InsurancePlan.BASIC, 100000)).toBe(800);
    expect(service.calculateInsurancePremium(InsurancePlan.PREMIUM, 100000)).toBe(1200);
    expect(service.calculateInsurancePremium(InsurancePlan.HIGH_VALUE, 100000)).toBe(1800);
  });

  it('estimates price with distance, insurance, and base fare', async () => {
    pricingRuleFindFirst.mockResolvedValue(null);

    const estimate = await service.estimatePrice({
      vehicleType: VehicleType.MINI_TRUCK,
      distanceKm: 20,
      insurancePlan: InsurancePlan.BASIC,
      goodsValue: 100000,
      driverRating: 4.9
    });

    expect(estimate.baseFare).toBe(420);
    expect(estimate.distanceFare).toBe(280);
    expect(estimate.insuranceCharge).toBe(800);
    expect(estimate.compareAtTotal).toBeGreaterThan(estimate.total);
    expect(estimate.offerDiscountPercent).toBe(8);
    expect(estimate.offerDiscountAmount).toBeGreaterThan(0);
  });
});
