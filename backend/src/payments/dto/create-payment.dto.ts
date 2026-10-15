import { IsIn, IsUUID } from 'class-validator';
import type { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsIn(['WALLET', 'CARD'])
  method!: PaymentMethod;

  @IsUUID()
  idempotencyKey!: string;
}
