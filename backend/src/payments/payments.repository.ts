import { Injectable } from '@nestjs/common';
import { Prisma, type PaymentMethod, type PaymentStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';

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

  findByKey(userId: string, idempotencyKey: string) {
    return this.prisma.payment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
  }

  async claim(input: ClaimInput) {
    try {
      return {
        created: true as const,
        payment: await this.prisma.payment.create({
          data: { ...input, status: 'PROCESSING' },
        }),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const payment = await this.findByKey(
          input.userId,
          input.idempotencyKey,
        );
        if (payment) return { created: false as const, payment };
      }
      throw error;
    }
  }

  finalize(id: string, status: Exclude<PaymentStatus, 'PROCESSING'>) {
    return this.prisma.payment.update({ where: { id }, data: { status } });
  }
}
