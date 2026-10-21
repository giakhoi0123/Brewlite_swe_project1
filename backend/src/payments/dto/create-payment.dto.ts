import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { PaymentMethod, PaymentStatus } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsIn(['WALLET', 'CARD'])
  method!: PaymentMethod;

  // Also accepted from the Idempotency-Key header; controller requires one source.
  @IsOptional()
  @IsUUID()
  idempotencyKey!: string;

  /** Sandbox only; ignored unless PAYMENT_DEMO_CONTROLS=true on the server. */
  @IsOptional()
  @IsIn(['PAID', 'PAYMENT_FAILED', 'UNKNOWN'])
  demoOutcome?: Exclude<PaymentStatus, 'PROCESSING'>;
}
