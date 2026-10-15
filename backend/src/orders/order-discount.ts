import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const ORDER_DISCOUNT = Symbol('ORDER_DISCOUNT');
export interface OrderDiscount {
  calculate(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      subtotal: number;
      promotionCode?: string;
    },
  ): Promise<number>;
}

// TV6 replaces this provider with its transactional promotion implementation.
@Injectable()
export class NoPromotionDiscount implements OrderDiscount {
  async calculate(
    _tx: Prisma.TransactionClient,
    input: { promotionCode?: string },
  ) {
    if (input.promotionCode) {
      throw new UnprocessableEntityException('Mã ưu đãi chưa được hỗ trợ');
    }
    return 0;
  }
}
