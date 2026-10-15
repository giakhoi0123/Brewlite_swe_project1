import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Payment, PaymentStatus } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  PAYMENT_GATEWAY,
  PAYMENT_ORDER_PORT,
  type PaymentGateway,
  type PaymentOrderPort,
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
    const existing = await this.payments.findByKey(
      userId,
      input.idempotencyKey,
    );
    if (existing) return this.replay(existing, userId, input);

    const order = await this.orders.findOwned(input.orderId, userId);
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (!['PENDING', 'PAYMENT_FAILED'].includes(order.status))
      throw new ConflictException('Đơn hàng không thể thanh toán');

    const claim = await this.payments.claim({
      userId,
      orderId: order.id,
      amount: order.total,
      method: input.method,
      idempotencyKey: input.idempotencyKey,
    });
    if (!claim.created) return this.replay(claim.payment, userId, input);

    let status: Exclude<PaymentStatus, 'PROCESSING'>;
    try {
      status = await this.gateway.charge({
        orderId: order.id,
        amount: order.total,
        method: input.method,
      });
    } catch {
      status = 'UNKNOWN';
    }
    const payment = await this.payments.finalize(claim.payment.id, status);
    await this.orders.applyPaymentResult({
      orderId: order.id,
      userId,
      method: input.method,
      status,
    });
    return this.toResponse(payment);
  }

  private async replay(
    payment: Payment,
    userId: string,
    input: CreatePaymentDto,
  ) {
    if (payment.orderId !== input.orderId || payment.method !== input.method)
      throw new ConflictException(
        'Idempotency key đã được dùng cho yêu cầu khác',
      );
    if (payment.status === 'PROCESSING')
      throw new ConflictException('Yêu cầu thanh toán đang được xử lý');
    await this.orders.applyPaymentResult({
      orderId: payment.orderId,
      userId,
      method: payment.method,
      status: payment.status,
    });
    return this.toResponse(payment);
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
