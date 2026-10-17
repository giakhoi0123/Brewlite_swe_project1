import { Injectable } from '@nestjs/common';
import type { PaymentGateway, PaymentResultStatus } from './payment.types';

const publicStatuses = ['PAID', 'PAYMENT_FAILED', 'UNKNOWN'] as const;

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  async charge(): Promise<PaymentResultStatus> {
    const configured = process.env.MOCK_PAYMENT_OUTCOME;
    return publicStatuses.includes(
      configured as (typeof publicStatuses)[number],
    )
      ? (configured as PaymentResultStatus)
      : 'PAID';
  }
}
