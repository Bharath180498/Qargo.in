import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Injectable()
export class PaymentsService {
  private static readonly CARD_SURCHARGE_PERCENT = 2.5;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  private get razorpayKeyId() {
    return this.configService.get<string>('razorpay.keyId') ?? '';
  }

  private get razorpayKeySecret() {
    return this.configService.get<string>('razorpay.keySecret') ?? '';
  }

  private get razorpayWebhookSecret() {
    return this.configService.get<string>('razorpay.webhookSecret') ?? '';
  }

  private get upiPayeeVpa() {
    return this.configService.get<string>('upi.payeeVpa') ?? '';
  }

  private get upiPayeeName() {
    return this.configService.get<string>('upi.payeeName') ?? 'Qargo Logistics';
  }

  private toPaise(amount: number) {
    return Math.round(amount * 100);
  }

  private roundCurrency(amount: number) {
    return Math.round(amount * 100) / 100;
  }

  private pricingBreakdown(provider: PaymentProvider, baseAmount: number) {
    const surchargePercent =
      provider === PaymentProvider.RAZORPAY ? PaymentsService.CARD_SURCHARGE_PERCENT : 0;
    const surchargeAmount = this.roundCurrency((baseAmount * surchargePercent) / 100);
    const totalAmount = this.roundCurrency(baseAmount + surchargeAmount);

    return {
      baseAmount,
      surchargePercent,
      surchargeAmount,
      totalAmount
    };
  }

  private safeEqual(a: string, b: string) {
    const first = Buffer.from(a);
    const second = Buffer.from(b);
    if (first.length !== second.length) {
      return false;
    }
    return timingSafeEqual(first, second);
  }

  private resolveWebhookProviderRef(payload: {
    providerRef?: string;
    payload?: {
      payment?: {
        entity?: {
          order_id?: string;
        };
      };
    };
  }) {
    return payload.providerRef ?? payload.payload?.payment?.entity?.order_id;
  }

  private verifyRazorpaySignature(
    payload: Record<string, unknown>,
    signature?: string
  ) {
    if (!this.razorpayWebhookSecret) {
      return true;
    }
    if (!signature) {
      return false;
    }

    const expected = createHmac('sha256', this.razorpayWebhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    return this.safeEqual(expected, signature);
  }

  private buildUpiIntent(
    paymentId: string,
    amount: number,
    options?: {
      vpa?: string;
      name?: string;
      note?: string;
    }
  ) {
    const vpa = options?.vpa?.trim() || this.upiPayeeVpa || 'qargo.demo@upi';
    const payeeName = options?.name?.trim() || this.upiPayeeName;
    const note = options?.note?.trim() || `Qargo Order ${paymentId.slice(0, 8)}`;

    const params = new URLSearchParams({
      pa: vpa,
      pn: payeeName,
      tn: note,
      tr: paymentId,
      am: amount.toFixed(2),
      cu: 'INR'
    });

    return `upi://pay?${params.toString()}`;
  }

  private async createRazorpayOrder(input: { orderId: string; amount: number }) {
    if (!this.razorpayKeyId || !this.razorpayKeySecret) {
      return {
        mode: 'mock' as const,
        providerRef: `rzp_order_${Date.now()}`,
        clientSecret: `rzp_client_secret_${Date.now()}`,
        reason: 'Razorpay keys missing'
      };
    }

    try {
      const response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.razorpayKeyId}:${this.razorpayKeySecret}`
          ).toString('base64')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount: this.toPaise(input.amount),
          currency: 'INR',
          receipt: `qargo_${input.orderId.slice(0, 16)}`,
          notes: {
            orderId: input.orderId
          }
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        error?: {
          description?: string;
        };
      };

      if (!response.ok || !payload.id) {
        return {
          mode: 'mock' as const,
          providerRef: `rzp_order_${Date.now()}`,
          clientSecret: `rzp_client_secret_${Date.now()}`,
          reason: payload.error?.description ?? `Razorpay error ${response.status}`
        };
      }

      return {
        mode: 'live' as const,
        providerRef: payload.id,
        clientSecret: this.razorpayKeyId
      };
    } catch {
      return {
        mode: 'mock' as const,
        providerRef: `rzp_order_${Date.now()}`,
        clientSecret: `rzp_client_secret_${Date.now()}`,
        reason: 'Razorpay request failed'
      };
    }
  }

  async createIntent(payload: CreatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        trip: {
          include: {
            driver: {
              include: {
                user: true,
                payoutAccount: true,
                paymentMethods: {
                  where: { isActive: true },
                  orderBy: [{ isPreferred: 'desc' }, { updatedAt: 'desc' }]
                }
              }
            }
          }
        }
      }
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const computedBaseAmount = this.roundCurrency(
      Number(order.finalPrice ?? order.estimatedPrice ?? payload.amount)
    );
    const breakdown = this.pricingBreakdown(payload.provider, computedBaseAmount);

    const defaultProviderRef = `intent_${payload.provider.toLowerCase()}_${Date.now()}`;

    const payment = await this.prisma.payment.upsert({
      where: { orderId: payload.orderId },
      update: {
        amount: breakdown.totalAmount,
        provider: payload.provider,
        status: PaymentStatus.PENDING,
        providerRef: defaultProviderRef
      },
      create: {
        orderId: payload.orderId,
        amount: breakdown.totalAmount,
        provider: payload.provider,
        status: PaymentStatus.PENDING,
        providerRef: defaultProviderRef
      }
    });

    if (payload.provider === PaymentProvider.RAZORPAY) {
      const razorpayOrder = await this.createRazorpayOrder({
        orderId: payload.orderId,
        amount: breakdown.totalAmount
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: razorpayOrder.providerRef
        }
      });

      return {
        paymentId: updated.id,
        provider: updated.provider,
        providerRef: updated.providerRef,
        clientSecret: razorpayOrder.clientSecret,
        amount: Number(updated.amount),
        amountPaise: this.toPaise(Number(updated.amount)),
        currency: 'INR',
        mode: razorpayOrder.mode,
        reason: razorpayOrder.reason,
        ...breakdown
      };
    }

    if (payload.provider === PaymentProvider.UPI) {
      const driverPaymentMethods = order.trip?.driver?.paymentMethods ?? [];
      const selectedDriverMethod = payload.driverPaymentMethodId
        ? driverPaymentMethods.find((method) => method.id === payload.driverPaymentMethodId)
        : undefined;
      const preferredDriverMethod =
        selectedDriverMethod ??
        driverPaymentMethods.find((method) => method.isPreferred) ??
        driverPaymentMethods[0];

      const driverPayeeVpa =
        preferredDriverMethod?.upiId?.trim() ??
        order.trip?.driver?.payoutAccount?.upiId?.trim();
      const directPayeeVpa =
        payload.directUpiVpa?.trim() || (payload.directPayToDriver ? driverPayeeVpa : '');
      const resolvedPayeeVpa = directPayeeVpa || this.upiPayeeVpa || 'qargo.demo@upi';
      const resolvedPayeeName =
        payload.directUpiName?.trim() ||
        (payload.directPayToDriver
          ? preferredDriverMethod?.label?.trim() || order.trip?.driver?.user?.name?.trim()
          : '') ||
        this.upiPayeeName;
      const isDirectToDriver = Boolean(payload.directPayToDriver && directPayeeVpa);
      const upiIntentUrl = this.buildUpiIntent(payment.id, Number(payment.amount), {
        vpa: resolvedPayeeVpa,
        name: resolvedPayeeName,
        note: isDirectToDriver ? `Qargo Driver ${payment.id.slice(0, 8)}` : undefined
      });
      const providerRef = `${isDirectToDriver ? 'upi_direct' : 'upi'}_${payment.id}`;
      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerRef }
      });

      return {
        paymentId: updated.id,
        provider: updated.provider,
        providerRef: updated.providerRef,
        upiIntentUrl,
        amount: Number(updated.amount),
        currency: 'INR',
        mode: resolvedPayeeVpa.includes('@') ? 'live' : 'mock',
        payee: {
          vpa: resolvedPayeeVpa,
          name: resolvedPayeeName,
          directToDriver: isDirectToDriver,
          paymentMethodId: preferredDriverMethod?.id,
          qrImageUrl: preferredDriverMethod?.qrImageUrl ?? undefined
        },
        ...breakdown
      };
    }

    return {
      paymentId: payment.id,
      provider: payment.provider,
      providerRef: payment.providerRef,
      clientSecret: `client_secret_${payment.id}`,
      amount: Number(payment.amount),
      currency: 'INR',
      mode: 'mock',
      ...breakdown
    };
  }

  async confirm(payload: ConfirmPaymentDto) {
    const payment = await this.prisma.payment.findUnique({ where: { id: payload.paymentId } });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: payload.success ? PaymentStatus.CAPTURED : PaymentStatus.FAILED,
        providerRef: payload.providerReference ?? payment.providerRef
      }
    });

    return {
      paymentId: updated.id,
      status: updated.status,
      provider: updated.provider,
      providerRef: updated.providerRef,
      settledAt:
        updated.status === PaymentStatus.CAPTURED ? updated.updatedAt.toISOString() : undefined
    };
  }

  defaultProvider() {
    return PaymentProvider.RAZORPAY;
  }

  async handleRazorpayWebhook(payload: {
    event: string;
    providerRef?: string;
    payload?: {
      payment?: {
        entity?: {
          order_id?: string;
        };
      };
    };
    success?: boolean;
  }, signature?: string) {
    if (!this.verifyRazorpaySignature(payload as Record<string, unknown>, signature)) {
      return {
        received: true,
        updated: false,
        reason: 'invalid webhook signature'
      };
    }

    const providerRef = this.resolveWebhookProviderRef(payload);
    if (!providerRef) {
      return {
        received: true,
        updated: false,
        reason: 'providerRef missing'
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: PaymentProvider.RAZORPAY,
        providerRef
      }
    });

    if (!payment) {
      return {
        received: true,
        updated: false,
        reason: 'payment not found'
      };
    }

    const successByEvent =
      payload.event === 'payment.captured' ||
      payload.event === 'payment.authorized' ||
      payload.event === 'order.paid';
    const failureByEvent = payload.event === 'payment.failed';
    const isSuccess =
      typeof payload.success === 'boolean'
        ? payload.success
        : successByEvent && !failureByEvent;
    const status = isSuccess ? PaymentStatus.CAPTURED : PaymentStatus.FAILED;
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status
      }
    });

    return {
      received: true,
      updated: true,
      paymentId: updated.id,
      status: updated.status
    };
  }
}
