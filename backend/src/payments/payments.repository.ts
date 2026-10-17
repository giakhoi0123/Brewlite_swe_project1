import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { PaymentResultStatus } from './payment.types';

type ClaimInput = {
  userId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  idempotencyKey: string;
};

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async withOrderLock<T>(
    orderId: string,
    userId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const owned = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM orders
          WHERE id = ${orderId}::uuid AND user_id = ${userId}::uuid
          FOR UPDATE
        `);
        if (!owned.length)
          throw new NotFoundException('Không tìm thấy đơn hàng');
        return work(tx);
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2034'].includes(error.code)
      ) {
        throw new ConflictException(
          'Yêu cầu thanh toán trùng hoặc đơn hàng vừa thay đổi',
        );
      }
      throw error;
    }
  }

  findByKey(
    userId: string,
    idempotencyKey: string,
    tx: Prisma.TransactionClient,
  ) {
    return tx.payment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
  }

  findBlockingAttempt(orderId: string, tx: Prisma.TransactionClient) {
    return tx.payment.findFirst({
      where: { orderId, status: { in: ['PROCESSING', 'UNKNOWN', 'PAID'] } },
    });
  }

  async claim(input: ClaimInput, tx: Prisma.TransactionClient) {
    return tx.payment.create({ data: { ...input, status: 'PROCESSING' } });
  }

  // Commit the gateway journal BEFORE applying Order/points. If it fails,
  // leave PROCESSING blocked for reconciliation; never charge again automatically.
  async recordGatewayResult(id: string, status: PaymentResultStatus) {
    const recorded = await this.prisma.payment.updateMany({
      where: { id, status: 'PROCESSING', gatewayStatus: null },
      data: { gatewayStatus: status },
    });
    if (recorded.count !== 1)
      throw new ConflictException('Kết quả gateway đã thay đổi');
  }

  async finalize(
    id: string,
    status: PaymentResultStatus,
    tx: Prisma.TransactionClient,
  ) {
    return tx.payment.update({
      where: { id },
      data: { status, appliedAt: new Date() },
    });
  }
}
