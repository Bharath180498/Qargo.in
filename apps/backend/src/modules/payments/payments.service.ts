import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Injectable()
export class PaymentsService {
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

  private buildUpiIntent(paymentId: string, amount: number) {
    const vpa = this.upiPayeeVpa || 'qargo.demo@upi';
    const params = new URLSearchParams({
      pa: vpa,
      pn: this.upiPayeeName,
      tn: `Qargo Order ${paymentId.slice(0, 8)}`,
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
    const order = await this.prisma.order.findUnique({ where: { id: payload.orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const defaultProviderRef = `intent_${payload.provider.toLowerCase()}_${Date.now()}`;

    const payment = await this.prisma.payment.upsert({
      where: { orderId: payload.orderId },
      update: {
        amount: payload.amount,
        provider: payload.provider,
        status: PaymentStatus.PENDING,
        providerRef: defaultProviderRef
      },
      create: {
        orderId: payload.orderId,
        amount: payload.amount,
        provider: payload.provider,
        status: PaymentStatus.PENDING,
        providerRef: defaultProviderRef
      }
    });

    if (payload.provider === PaymentProvider.RAZORPAY) {
      const razorpayOrder = await this.createRazorpayOrder({
        orderId: payload.orderId,
        amount: payload.amount
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
        reason: razorpayOrder.reason
      };
    }

    if (payload.provider === PaymentProvider.UPI) {
      const upiIntentUrl = this.buildUpiIntent(payment.id, Number(payment.amount));
      const providerRef = `upi_${payment.id}`;
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
        mode: this.upiPayeeVpa ? 'live' : 'mock'
      };
    }

    return {
      paymentId: payment.id,
      provider: payment.provider,
      providerRef: payment.providerRef,
      clientSecret: `client_secret_${payment.id}`,
      amount: Number(payment.amount),
      currency: 'INR',
      mode: 'mock'
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
