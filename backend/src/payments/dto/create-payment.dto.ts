import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsIn(['VNPAY_QR'])
  method!: PaymentMethod;

  // Also accepted from the Idempotency-Key header; controller requires one source.
  @IsOptional()
  @IsUUID()
  idempotencyKey!: string;
}
