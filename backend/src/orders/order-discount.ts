import { Injectable, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
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

// Deterministic provider used by Orders unit/PostgreSQL tests. The runtime
// module continues to use PromotionDiscount below.
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

// Danh sách các mã ưu đãi mặc định hỗ trợ sẵn
const DEFAULT_PROMOTIONS: Record<
  string,
  { minSubtotal: number; type: 'FIXED' | 'PERCENT'; value: number; maxDiscount?: number }
> = {
  WELCOME10: { minSubtotal: 50000, type: 'FIXED', value: 10000 },
  BREW20: { minSubtotal: 100000, type: 'FIXED', value: 20000 },
  DISCOUNT10: { minSubtotal: 30000, type: 'PERCENT', value: 10, maxDiscount: 30000 },
};

@Injectable()
export class PromotionDiscount implements OrderDiscount {
  async calculate(
    tx: Prisma.TransactionClient,
    input: {
      userId: string;
      subtotal: number;
      promotionCode?: string;
    },
  ): Promise<number> {
    if (!input.promotionCode || !input.promotionCode.trim()) {
      return 0;
    }

    const code = input.promotionCode.trim().toUpperCase();

    // 1. Kiểm tra CSDL Prisma nếu bảng Promotion tồn tại
    if ('promotion' in tx && typeof (tx as any).promotion?.findUnique === 'function') {
      try {
        const promo = await (tx as any).promotion.findUnique({
          where: { code },
        });

        if (promo) {
          if (!promo.isActive) {
            throw new BadRequestException('Mã ưu đãi đã hết hạn hoặc ngưng áp dụng');
          }
          if (promo.minSubtotal && input.subtotal < promo.minSubtotal) {
            throw new BadRequestException(
              `Đơn hàng cần tối thiểu ${promo.minSubtotal.toLocaleString('vi-VN')} đ để áp dụng mã ${code}`,
            );
          }

          let discount = 0;
          if (promo.discountType === 'PERCENT') {
            discount = Math.round((input.subtotal * promo.discountValue) / 100);
            if (promo.maxDiscountAmount && discount > promo.maxDiscountAmount) {
              discount = promo.maxDiscountAmount;
            }
          } else {
            discount = promo.discountValue;
          }

          return Math.min(discount, input.subtotal);
        }
      } catch (err) {
        if (err instanceof BadRequestException) throw err;
      }
    }

    // 2. Kiểm tra danh sách mã mặc định hệ thống
    const defaultPromo = DEFAULT_PROMOTIONS[code];
    if (!defaultPromo) {
      throw new BadRequestException(
        `Mã ưu đãi "${code}" không hợp lệ hoặc không tồn tại`,
      );
    }

    if (input.subtotal < defaultPromo.minSubtotal) {
      throw new BadRequestException(
        `Đơn hàng cần tối thiểu ${defaultPromo.minSubtotal.toLocaleString('vi-VN')} đ để áp dụng mã ${code}`,
      );
    }

    let discountAmount = 0;
    if (defaultPromo.type === 'PERCENT') {
      discountAmount = Math.round((input.subtotal * defaultPromo.value) / 100);
      if (defaultPromo.maxDiscount && discountAmount > defaultPromo.maxDiscount) {
        discountAmount = defaultPromo.maxDiscount;
      }
    } else {
      discountAmount = defaultPromo.value;
    }

    return Math.min(discountAmount, input.subtotal);
  }
}
