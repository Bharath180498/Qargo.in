import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ConfirmPaymentDto } from './dto/confirm-payment.dto';

interface CashfreeWebhookPayload {
  type?: string;
  order_id?: string;
  orderId?: string;
  order_status?: string;
  payment_status?: string;
  txStatus?: string;
  data?: {
    order?: {
      order_id?: string;
      orderId?: string;
      order_status?: string;
    };
    payment?: {
      order_id?: string;
      payment_status?: string;
      cf_payment_id?: string | number;
      payment_id?: string;
    };
  };
}

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

  private get cashfreeClientId() {
    return this.configService.get<string>('cashfree.clientId') ?? '';
  }

  private get cashfreeClientSecret() {
    return this.configService.get<string>('cashfree.clientSecret') ?? '';
  }

  private get cashfreeApiVersion() {
    return this.configService.get<string>('cashfree.apiVersion') ?? '2023-08-01';
  }

  private get cashfreePaymentsApiUrl() {
    return this.configService.get<string>('cashfree.paymentsApiUrl') ?? 'https://api.cashfree.com/pg/orders';
  }

  private get cashfreeWebhookSecret() {
    return this.configService.get<string>('cashfree.webhookSecret') ?? '';
  }

  private get cashfreePaymentReturnUrl() {
    return this.configService.get<string>('cashfree.paymentReturnUrl') ?? '';
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
      provider === PaymentProvider.RAZORPAY || provider === PaymentProvider.CASHFREE
        ? PaymentsService.CARD_SURCHARGE_PERCENT
        : 0;
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

  private normalizePhone(input?: string | null) {
    const digits = (input ?? '').replace(/\D/g, '');
    if (!digits) {
      return '9999999999';
    }
    if (digits.length >= 10) {
      return digits.slice(-10);
    }
    return digits.padStart(10, '0');
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

  private extractString(
    payload: Record<string, unknown>,
    path: string
  ) {
    const segments = path.split('.');
    let cursor: unknown = payload;

    for (const segment of segments) {
      if (!cursor || typeof cursor !== 'object' || !(segment in cursor)) {
        return undefined;
      }

      cursor = (cursor as Record<string, unknown>)[segment];
    }

    if (typeof cursor === 'string' && cursor.trim()) {
      return cursor.trim();
    }

    if (typeof cursor === 'number') {
      return String(cursor);
    }

    return undefined;
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

  private verifyCashfreeSignature(
    payload: Record<string, unknown>,
    signature?: string,
    timestamp?: string
  ) {
    if (!this.cashfreeWebhookSecret) {
      return true;
    }

    if (!signature) {
      return false;
    }

    const normalized = signature.replace(/^sha256=/i, '').trim();
    const body = JSON.stringify(payload);

    const candidates = [
      createHmac('sha256', this.cashfreeWebhookSecret).update(body).digest('hex'),
      createHmac('sha256', this.cashfreeWebhookSecret).update(body).digest('base64')
    ];

    if (timestamp?.trim()) {
      const signedPayload = `${timestamp.trim()}.${body}`;
      candidates.push(createHmac('sha256', this.cashfreeWebhookSecret).update(signedPayload).digest('hex'));
      candidates.push(createHmac('sha256', this.cashfreeWebhookSecret).update(signedPayload).digest('base64'));
    }

    return candidates.some((candidate) => this.safeEqual(candidate, normalized));
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

  private buildCashfreeHostedCheckoutUrl(paymentSessionId: string) {
    const normalized = this.cashfreePaymentsApiUrl.toLowerCase();
    const isTest = normalized.includes('sandbox') || normalized.includes('test');
    const base = isTest
      ? 'https://payments-test.cashfree.com/order/#'
      : 'https://payments.cashfree.com/order/#';

    return `${base}${paymentSessionId}`;
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

  private async createCashfreeOrder(input: {
    orderId: string;
    paymentId: string;
    amount: number;
    customerId: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string | null;
  }) {
    if (!this.cashfreeClientId || !this.cashfreeClientSecret) {
      return {
        mode: 'mock' as const,
        providerRef: `cf_order_${Date.now()}`,
        clientSecret: `cf_session_${Date.now()}`,
        checkoutUrl: undefined,
        reason: 'Cashfree credentials missing'
      };
    }

    const providerOrderId = `qargo_${input.orderId.slice(0, 10)}_${Date.now()}`;
    const customerPhone = this.normalizePhone(input.customerPhone);
    const customerName = (input.customerName ?? '').trim() || 'Qargo Customer';
    const customerEmail =
      (input.customerEmail ?? '').trim() || `${input.customerId.slice(0, 12)}@qargo.local`;

    const orderMeta = this.cashfreePaymentReturnUrl.trim()
      ? {
          return_url: this.cashfreePaymentReturnUrl.trim()
        }
      : undefined;

    try {
      const response = await fetch(this.cashfreePaymentsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-client-id': this.cashfreeClientId,
          'x-client-secret': this.cashfreeClientSecret,
          'x-api-version': this.cashfreeApiVersion
        },
        body: JSON.stringify({
          order_id: providerOrderId,
          order_amount: this.roundCurrency(input.amount),
          order_currency: 'INR',
          order_note: `Qargo Order ${input.orderId.slice(0, 8)}`,
          customer_details: {
            customer_id: input.customerId,
            customer_name: customerName,
            customer_phone: customerPhone,
            customer_email: customerEmail
          },
          ...(orderMeta ? { order_meta: orderMeta } : {})
        })
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      const orderId =
        this.extractString(payload, 'order_id') ??
        this.extractString(payload, 'data.order.order_id') ??
        providerOrderId;
      const paymentSessionId =
        this.extractString(payload, 'payment_session_id') ??
        this.extractString(payload, 'order_token') ??
        this.extractString(payload, 'data.payment_session_id');
      const explicitCheckoutUrl =
        this.extractString(payload, 'payment_link') ??
        this.extractString(payload, 'data.payment_link') ??
        this.extractString(payload, 'order_meta.payment_link') ??
        this.extractString(payload, 'order_meta.payment_url');
      const checkoutUrl =
        explicitCheckoutUrl ??
        (paymentSessionId ? this.buildCashfreeHostedCheckoutUrl(paymentSessionId) : undefined);

      if (!response.ok) {
        return {
          mode: 'mock' as const,
          providerRef: orderId,
          clientSecret: paymentSessionId,
          checkoutUrl,
          reason: this.extractString(payload, 'message') ?? `Cashfree error ${response.status}`
        };
      }

      return {
        mode: 'live' as const,
        providerRef: orderId,
        clientSecret: paymentSessionId,
        checkoutUrl,
        reason: undefined
      };
    } catch {
      return {
        mode: 'mock' as const,
        providerRef: providerOrderId,
        clientSecret: `cf_session_${Date.now()}`,
        checkoutUrl: undefined,
        reason: 'Cashfree request failed'
      };
    }
  }

  async createIntent(payload: CreatePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: payload.orderId },
      include: {
        customer: true,
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

    if (payload.provider === PaymentProvider.CASHFREE) {
      const cashfreeOrder = await this.createCashfreeOrder({
        orderId: payload.orderId,
        paymentId: payment.id,
        amount: breakdown.totalAmount,
        customerId: order.customerId,
        customerName: order.customer?.name,
        customerPhone: order.customer?.phone,
        customerEmail: order.customer?.email
      });

      const updated = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerRef: cashfreeOrder.providerRef
        }
      });

      return {
        paymentId: updated.id,
        provider: updated.provider,
        providerRef: updated.providerRef,
        clientSecret: cashfreeOrder.clientSecret,
        checkoutUrl: cashfreeOrder.checkoutUrl,
        amount: Number(updated.amount),
        amountPaise: this.toPaise(Number(updated.amount)),
        currency: 'INR',
        mode: cashfreeOrder.mode,
        reason: cashfreeOrder.reason,
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
    return PaymentProvider.CASHFREE;
  }

  async handleRazorpayWebhook(
    payload: {
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
    },
    signature?: string
  ) {
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

  async handleCashfreeWebhook(
    payload: CashfreeWebhookPayload,
    signature?: string,
    timestamp?: string
  ) {
    if (!this.verifyCashfreeSignature(payload as Record<string, unknown>, signature, timestamp)) {
      return {
        received: true,
        updated: false,
        reason: 'invalid webhook signature'
      };
    }

    const providerRef =
      payload.order_id ??
      payload.orderId ??
      payload.data?.order?.order_id ??
      payload.data?.order?.orderId ??
      payload.data?.payment?.order_id;

    if (!providerRef) {
      return {
        received: true,
        updated: false,
        reason: 'providerRef missing'
      };
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        provider: PaymentProvider.CASHFREE,
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

    const rawStatus = String(
      payload.data?.payment?.payment_status ??
        payload.payment_status ??
        payload.txStatus ??
        payload.data?.order?.order_status ??
        payload.order_status ??
        payload.type ??
        ''
    )
      .trim()
      .toUpperCase();

    const successStatuses = new Set(['SUCCESS', 'PAID', 'CAPTURED', 'COMPLETED', 'CHARGED']);
    const failureStatuses = new Set(['FAILED', 'FAILURE', 'CANCELLED', 'USER_DROPPED', 'DECLINED']);
    const pendingStatuses = new Set(['PENDING', 'NOT_ATTEMPTED', 'ACTIVE', 'INITIALIZED']);

    let nextStatus: PaymentStatus | undefined;

    if (successStatuses.has(rawStatus) || rawStatus.includes('SUCCESS')) {
      nextStatus = PaymentStatus.CAPTURED;
    } else if (failureStatuses.has(rawStatus) || rawStatus.includes('FAIL')) {
      nextStatus = PaymentStatus.FAILED;
    } else if (pendingStatuses.has(rawStatus) || rawStatus.includes('PENDING')) {
      nextStatus = PaymentStatus.PENDING;
    }

    if (!nextStatus || nextStatus === PaymentStatus.PENDING) {
      return {
        received: true,
        updated: false,
        reason: `status ${rawStatus || 'UNKNOWN'} ignored`,
        providerRef
      };
    }

    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus
      }
    });

    return {
      received: true,
      updated: true,
      paymentId: updated.id,
      status: updated.status,
      providerRef,
      rawStatus
    };
  }
}
