import type { PaymentMethod, PaymentStatus } from '@prisma/client';

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
  applyPaymentResult(input: {
    orderId: string;
    userId: string;
    method: PaymentMethod;
    status: PaymentResultStatus;
  }): Promise<void>;
}

export interface PaymentGateway {
  charge(input: {
    orderId: string;
    amount: number;
    method: PaymentMethod;
  }): Promise<PaymentResultStatus>;
}
