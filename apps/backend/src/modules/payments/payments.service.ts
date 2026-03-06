import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createIntent(payload: CreatePaymentDto) {
    const order = await this.prisma.order.findUnique({ where: { id: payload.orderId } });
    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const providerRef =
      payload.provider === PaymentProvider.RAZORPAY
        ? `rzp_order_${Date.now()}`
        : `intent_${payload.provider.toLowerCase()}_${Date.now()}`;

    const payment = await this.prisma.payment.upsert({
      where: { orderId: payload.orderId },
      update: {
        amount: payload.amount,
        provider: payload.provider,
        status: PaymentStatus.PENDING,
        providerRef
      },
      create: {
        orderId: payload.orderId,
        amount: payload.amount,
        provider: payload.provider,
        status: PaymentStatus.PENDING,
        providerRef
      }
    });

    return {
      paymentId: payment.id,
      provider: payment.provider,
      providerRef: payment.providerRef,
      clientSecret:
        payload.provider === PaymentProvider.RAZORPAY
          ? `rzp_client_secret_${payment.id}`
          : `client_secret_${payment.id}`,
      amount: Number(payment.amount)
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
      providerRef: updated.providerRef
    };
  }

  defaultProvider() {
    return PaymentProvider.RAZORPAY;
  }

  async handleRazorpayWebhook(payload: {
    event: string;
    providerRef?: string;
    success?: boolean;
  }) {
    if (!payload.providerRef) {
      return {
        received: true,
        updated: false,
        reason: 'providerRef missing'
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: PaymentProvider.RAZORPAY,
        providerRef: payload.providerRef
      }
    });

    if (!payment) {
      return {
        received: true,
        updated: false,
        reason: 'payment not found'
      };
    }

    const status = payload.success ? PaymentStatus.CAPTURED : PaymentStatus.FAILED;
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
