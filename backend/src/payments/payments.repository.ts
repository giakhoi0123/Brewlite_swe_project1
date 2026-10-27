import { Injectable } from '@nestjs/common';
import { Prisma, type PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import type { PaymentFinalStatus } from './payment.types';

type CreateInput = {
  userId: string;
  orderId: string;
  amount: number;
  method: PaymentMethod;
  idempotencyKey: string;
  vnpTxnRef: string;
  paymentUrl: string;
  expiresAt: Date;
};

type FinalizeInput = {
  id: string;
  status: PaymentFinalStatus;
  responseCode: string;
  transactionStatus: string;
  transactionNo?: string;
  bankCode?: string;
  cardType?: string;
  payDate?: string;
  processedAt: Date;
};

type DbClient = PrismaService | Prisma.TransactionClient;

@Injectable()
export class PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  transaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.prisma.$transaction(work);
  }

  findByKey(
    userId: string,
    idempotencyKey: string,
    client: DbClient = this.prisma,
  ) {
    return client.payment.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey } },
    });
  }

  findByTxnRef(vnpTxnRef: string, client: DbClient = this.prisma) {
    return client.payment.findUnique({ where: { vnpTxnRef } });
  }

  findLatestForOwnedOrder(
    orderId: string,
    userId: string,
    client: DbClient = this.prisma,
  ) {
    return client.payment.findFirst({
      where: { orderId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  create(tx: Prisma.TransactionClient, input: CreateInput) {
    return tx.payment.create({
      data: { ...input, status: 'PROCESSING' },
    });
  }

  conditionalFinalize(tx: Prisma.TransactionClient, input: FinalizeInput) {
    return tx.payment.updateMany({
      where: { id: input.id, status: 'PROCESSING' },
      data: {
        status: input.status,
        vnpResponseCode: input.responseCode,
        vnpTransactionStatus: input.transactionStatus,
        vnpTransactionNo: input.transactionNo,
        vnpBankCode: input.bankCode,
        vnpCardType: input.cardType,
        vnpPayDate: input.payDate,
        processedAt: input.processedAt,
      },
    });
  }

  isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
