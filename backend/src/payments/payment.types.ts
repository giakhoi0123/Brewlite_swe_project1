import type { PaymentMethod, PaymentStatus, Prisma } from '@prisma/client';

export const PAYMENT_ORDER_PORT = Symbol('PAYMENT_ORDER_PORT');
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type PaymentResultStatus = Exclude<PaymentStatus, 'PROCESSING'>;

export type PayableOrder = {
  id: string;
  userId: string;
  total: number;
  status: string;
};

export interface PaymentOrderPort {
  findOwned(orderId: string, userId: string): Promise<PayableOrder | null>;
  prepareAttempt(
    input: { orderId: string; userId: string },
    tx: Prisma.TransactionClient,
  ): Promise<PayableOrder>;
  applyPaymentResult(
    input: {
      orderId: string;
      userId: string;
      method: PaymentMethod;
      status: PaymentResultStatus;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}

export interface PaymentGateway {
  charge(input: {
    orderId: string;
    amount: number;
    method: PaymentMethod;
    // Stable provider key of the persisted attempt; never regenerated on replay.
    idempotencyKey: string;
    demoOutcome?: PaymentResultStatus;
  }): Promise<PaymentResultStatus>;
}
