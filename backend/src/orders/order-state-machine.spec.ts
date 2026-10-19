import { ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { assertOrderTransition } from './order-state-machine';

const allowed = new Set([
  'PENDING:PAID',
  'PENDING:PAYMENT_FAILED',
  'PENDING:CANCELLED',
  'PAYMENT_FAILED:PENDING',
  'PAYMENT_FAILED:CANCELLED',
  'PAID:PREPARING',
  'PAID:CANCELLED',
  'PREPARING:READY',
  'PREPARING:CANCELLED',
  'READY:COMPLETED',
]);

describe('Order state machine: complete 7 × 7 transition matrix', () => {
  for (const from of Object.values(OrderStatus)) {
    for (const to of Object.values(OrderStatus)) {
      it(`${from} -> ${to}`, () => {
        if (allowed.has(`${from}:${to}`))
          expect(() => assertOrderTransition(from, to)).not.toThrow();
        else
          expect(() => assertOrderTransition(from, to)).toThrow(
            ConflictException,
          );
      });
    }
  }
});
