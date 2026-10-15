import { Injectable } from '@nestjs/common';
import type { PaymentStatus } from '@prisma/client';
import type { PaymentGateway } from './payment.types';

const publicStatuses = ['PAID', 'PAYMENT_FAILED', 'UNKNOWN'] as const;

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  async charge(): Promise<Exclude<PaymentStatus, 'PROCESSING'>> {
    const configured = process.env.MOCK_PAYMENT_OUTCOME;
    return publicStatuses.includes(
      configured as (typeof publicStatuses)[number],
    )
      ? (configured as Exclude<PaymentStatus, 'PROCESSING'>)
      : 'PAID';
  }
}
