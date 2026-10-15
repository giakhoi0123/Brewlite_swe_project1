import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

const transitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['PAID', 'PAYMENT_FAILED', 'CANCELLED'],
  PAYMENT_FAILED: ['PENDING', 'CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY'],
  READY: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
): void {
  if (!transitions[from]?.includes(to)) {
    throw new ConflictException(`Không thể chuyển đơn từ ${from} sang ${to}`);
  }
}
