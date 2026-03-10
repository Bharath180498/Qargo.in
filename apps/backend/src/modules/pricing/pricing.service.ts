import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InsurancePlan, VehicleType } from '@prisma/client';
import { RATING_PRICE_MULTIPLIERS, VEHICLE_BASE_FARE } from '@porter/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class PricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private get distanceRatePerKm() {
    const configured = Number(this.configService.get<number>('baseFarePerKm') ?? 14);
    if (!Number.isFinite(configured) || configured <= 0) {
      return 14;
    }
    return configured;
  }

  private get alwaysOnDiscountPercent() {
    const configured = Number(this.configService.get<number>('alwaysOnDiscountPercent') ?? 8);
    if (!Number.isFinite(configured)) {
      return 8;
    }
    return Math.min(30, Math.max(0, configured));
  }

  async getRatingMultiplier(driverRating: number) {
    const customRule = await this.prisma.pricingRule.findFirst({
      where: {
        minDriverRating: { lte: driverRating },
        maxDriverRating: { gt: driverRating }
      },
      orderBy: { minDriverRating: 'desc' }
    });

    if (customRule) {
      return customRule.multiplier;
    }

    const fallbackRule = RATING_PRICE_MULTIPLIERS.find((rule) => driverRating >= rule.min);
    return fallbackRule?.multiplier ?? 1;
  }

  calculateInsurancePremium(plan: InsurancePlan, goodsValue: number) {
    if (plan === InsurancePlan.NONE) {
      return 0;
    }

    const rate =
      plan === InsurancePlan.BASIC ? 0.008 : plan === InsurancePlan.PREMIUM ? 0.012 : 0.018;

    return Number((goodsValue * rate).toFixed(2));
  }

  async estimatePrice(input: {
    vehicleType: VehicleType;
    distanceKm: number;
    driverRating?: number;
    insurancePlan?: InsurancePlan;
    goodsValue?: number;
    waitingCharge?: number;
  }) {
    const baseFare = VEHICLE_BASE_FARE[input.vehicleType];
    const distanceFare = Math.max(0, input.distanceKm) * this.distanceRatePerKm;
    const waitingCharge = input.waitingCharge ?? 0;
    const insurancePlan = input.insurancePlan ?? InsurancePlan.NONE;
    const insuranceCharge = this.calculateInsurancePremium(insurancePlan, input.goodsValue ?? 0);

    const multiplier = input.driverRating ? await this.getRatingMultiplier(input.driverRating) : 1;
    const baseSubtotal = baseFare + distanceFare + waitingCharge + insuranceCharge;
    const adjustedSubtotal = baseSubtotal * multiplier;
    const offerDiscountPercent = this.alwaysOnDiscountPercent;
    const offerDiscountRate = offerDiscountPercent / 100;
    const offerDiscountAmount = Number((adjustedSubtotal * offerDiscountRate).toFixed(2));
    const total = Number(Math.max(0, adjustedSubtotal - offerDiscountAmount).toFixed(2));
    const compareAtTotal = Number((total + offerDiscountAmount).toFixed(2));
    const ratingAdjustment = Number((baseSubtotal - adjustedSubtotal).toFixed(2));

    return {
      baseFare,
      distanceFare: Number(distanceFare.toFixed(2)),
      waitingCharge,
      insuranceCharge,
      discount: Number((Math.max(0, ratingAdjustment) + offerDiscountAmount).toFixed(2)),
      compareAtTotal,
      offerDiscountAmount,
      offerDiscountPercent,
      total,
      multiplier
    };
  }

  listRules() {
    return this.prisma.pricingRule.findMany({ orderBy: { minDriverRating: 'desc' } });
  }

  upsertRule(input: { minDriverRating: number; maxDriverRating: number; multiplier: number }) {
    return this.prisma.pricingRule.create({
      data: input
    });
  }
}
