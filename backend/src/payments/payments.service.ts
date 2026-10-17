import { ConflictException, Inject, Injectable } from '@nestjs/common';
import type { Payment, Prisma } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PAYMENT_GATEWAY,
  PAYMENT_ORDER_PORT,
  type PaymentGateway,
  type PaymentOrderPort,
  type PaymentResultStatus,
} from './payment.types';
import { PaymentsRepository } from './payments.repository';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly payments: PaymentsRepository,
    @Inject(PAYMENT_ORDER_PORT) private readonly orders: PaymentOrderPort,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async pay(userId: string, input: CreatePaymentDto) {
    const started = await this.payments.withOrderLock(
      input.orderId,
      userId,
      async (tx) => {
        const existing = await this.payments.findByKey(
          userId,
          input.idempotencyKey,
          tx,
        );
        if (existing) {
          if (
            existing.orderId !== input.orderId ||
            existing.method !== input.method
          ) {
            throw new ConflictException(
              'Idempotency key đã được dùng cho yêu cầu khác',
            );
          }
          return {
            kind: 'replay' as const,
            payment: await this.settle(existing, tx),
          };
        }
        if (await this.payments.findBlockingAttempt(input.orderId, tx)) {
          throw new ConflictException(
            'Đơn hàng đã thanh toán hoặc có lần thanh toán chưa được xác minh',
          );
        }
        // Retry stock reservation and the new claim share this transaction.
        const order = await this.orders.prepareAttempt(
          { orderId: input.orderId, userId },
          tx,
        );
        const payment = await this.payments.claim(
          {
            userId,
            orderId: order.id,
            amount: order.total,
            method: input.method,
            idempotencyKey: input.idempotencyKey,
          },
          tx,
        );
        return { kind: 'charge' as const, payment };
      },
    );
    if (started.kind === 'replay') return this.toResponse(started.payment);

    // No database transaction/lock is held during the external gateway call.
    let status: PaymentResultStatus;
    try {
      status = await this.gateway.charge({
        orderId: started.payment.orderId,
        amount: started.payment.amount,
        method: started.payment.method,
        idempotencyKey: started.payment.id,
        ...(input.demoOutcome ? { demoOutcome: input.demoOutcome } : {}),
      });
    } catch {
      status = 'UNKNOWN';
    }
    await this.payments.recordGatewayResult(started.payment.id, status);
    const payment = await this.payments.withOrderLock(
      input.orderId,
      userId,
      async (tx) => {
        const current = await this.payments.findByKey(
          userId,
          input.idempotencyKey,
          tx,
        );
        if (!current)
          throw new ConflictException('Không tìm thấy lần thanh toán');
        return this.settle(current, tx);
      },
    );
    return this.toResponse(payment);
  }

  private async settle(
    payment: Payment,
    tx: Prisma.TransactionClient,
  ): Promise<Payment> {
    // Final responses are immutable, including legacy rows; never replay points.
    if (payment.status !== 'PROCESSING') return payment;
    const status = payment.gatewayStatus;
    if (!status || status === 'PROCESSING') {
      throw new ConflictException(
        'Yêu cầu thanh toán đang xử lý hoặc chờ đối soát',
      );
    }
    await this.orders.applyPaymentResult(
      {
        orderId: payment.orderId,
        userId: payment.userId,
        method: payment.method,
        status,
      },
      tx,
    );
    // Atomic with Order/stock/history/points. Rollback retains the committed
    // journal so replay can recover with the same key and no gateway call.
    return this.payments.finalize(payment.id, status, tx);
  }

  private toResponse(payment: Payment) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      method: payment.method,
      status: payment.status,
      idempotencyKey: payment.idempotencyKey,
    };
  }
}
