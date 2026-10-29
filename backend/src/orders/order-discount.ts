import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { resolveVoucher } from '../promotions/voucher-rules';

export const ORDER_DISCOUNT = Symbol('ORDER_DISCOUNT');

export interface OrderDiscount {
  calculate(
    tx: Prisma.TransactionClient,
    input: { userId: string; subtotal: number; promotionCode?: string },
  ): Promise<number>;
}

@Injectable()
export class PromotionDiscount implements OrderDiscount {
  async calculate(
    tx: Prisma.TransactionClient,
    input: { userId: string; subtotal: number; promotionCode?: string },
  ): Promise<number> {
    if (!input.promotionCode || !input.promotionCode.trim()) return 0;
    const res = await resolveVoucher(
      input.promotionCode,
      input.subtotal,
      tx,
      input.userId,
    );
    return res.discountAmount;
  }
}