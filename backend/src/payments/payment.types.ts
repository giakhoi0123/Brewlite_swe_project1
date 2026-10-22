import type { PaymentMethod, Prisma } from '@prisma/client';

export const PAYMENT_ORDER_PORT = Symbol('PAYMENT_ORDER_PORT');
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type PaymentFinalStatus = 'PAID' | 'PAYMENT_FAILED';

export type PayableOrder = {
  id: string;
  userId: string;
  total: number;
  status: string;
};

export interface PaymentOrderPort {
  findOwned(
    orderId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PayableOrder | null>;
  prepareRetry(
    orderId: string,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PayableOrder>;
  applyPaymentResult(
    input: {
      orderId: string;
      userId: string;
      method: PaymentMethod;
      status: PaymentFinalStatus;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<void>;
}

export interface PaymentGateway {
  createPaymentUrl(input: {
    txnRef: string;
    orderId: string;
    amount: number;
    ipAddress: string;
    now?: Date;
  }): { paymentUrl: string; expiresAt: Date };

  verifyCallback(query: VnpayQuery): VnpayVerification;
  queryTransaction(input: {
    txnRef: string;
    transactionDate: string;
    orderInfo: string;
    now?: Date;
  }): Promise<VnpayVerification>;
  isExpectedMerchant(tmnCode: string | undefined): boolean;
  frontendRedirect(path: string): string;
}

export type VnpayQuery = Record<
  string,
  string | string[] | Record<string, unknown> | undefined
>;

export type VnpayVerification =
  | { valid: true; params: Readonly<Record<string, string>> }
  | { valid: false; params: Readonly<Record<string, string>> };

export type VnpayIpnResponse = {
  RspCode: '00' | '01' | '02' | '04' | '97' | '99';
  Message:
    | 'Confirm Success'
    | 'Order not found'
    | 'Order already confirmed'
    | 'Invalid amount'
    | 'Invalid checksum'
    | 'Unknown error';
};
