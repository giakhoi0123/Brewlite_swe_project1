import { BadRequestException } from '@nestjs/common';

export interface VoucherResult {
  valid: boolean;
  code: string;
  discountAmount: number;
  title: string;
}

export async function resolveVoucher(
  codeRaw: string,
  subtotal: number,
  prismaClient?: any,
): Promise<VoucherResult> {
  if (!codeRaw || !codeRaw.trim()) {
    return { valid: true, code: '', discountAmount: 0, title: '' };
  }

  const code = codeRaw.trim().toUpperCase();

  // 1. KIỂM TRA MÃ ĐÃ SỬ DỤNG TRONG CSDL PRISMA
  if (prismaClient) {
    try {
      // A. Bắt buộc chặn nếu mã đã xuất hiện trong đơn hàng thành công/đang xử lý
      const existingOrder = await prismaClient.order?.findFirst?.({
        where: {
          promotionCode: code,
          status: { notIn: ['CANCELLED', 'PAYMENT_FAILED'] },
        },
      });

      if (existingOrder) {
        throw new BadRequestException(`Mã ưu đãi "${code}" đã được sử dụng`);
      }

      // B. Kiểm tra bảng CouponUsage
      const isUsedInUsage = await prismaClient.couponUsage?.findFirst?.({
        where: { code },
      });
      if (isUsedInUsage) {
        throw new BadRequestException(`Mã ưu đãi "${code}" đã được sử dụng`);
      }

      // C. Kiểm tra các bảng lưu UserCoupon / Coupon / LoyaltyTransaction
      const userCoupon =
        (await prismaClient.userCoupon?.findFirst?.({ where: { code } })) ||
        (await prismaClient.coupon?.findUnique?.({ where: { code } })) ||
        (await prismaClient.loyaltyTransaction?.findFirst?.({ where: { code } }));

      if (userCoupon) {
        if (userCoupon.isUsed || userCoupon.status === 'USED') {
          throw new BadRequestException(`Mã ưu đãi "${code}" đã được sử dụng`);
        }

        const discountVal =
          userCoupon.discountValue ??
          userCoupon.amount ??
          userCoupon.value ??
          userCoupon.discountAmount;

        if (discountVal && discountVal > 0) {
          const finalDiscount = Math.min(discountVal, subtotal);
          return {
            valid: true,
            code,
            discountAmount: finalDiscount,
            title:
              userCoupon.title ||
              userCoupon.name ||
              `Voucher giảm ${discountVal.toLocaleString('vi-VN')}đ`,
          };
        }
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
    }
  }

  // 2. NHẬN DIỆN MỆNH GIÁ THEO TIỀN TỐ MÃ ĐỔI ĐIỂM (REDEEM10-, REDEEM20-, REDEEM50-...)
  if (code.startsWith('REDEEM')) {
    let amount = 0;

    if (code.startsWith('REDEEM50-') || code.includes('50K')) {
      amount = 50000;
    } else if (code.startsWith('REDEEM30-') || code.includes('30K')) {
      amount = 30000;
    } else if (code.startsWith('REDEEM20-') || code.includes('20K')) {
      amount = 20000;
    } else if (code.startsWith('REDEEM10-') || code.includes('10K')) {
      amount = 10000;
    } else {
      // Bóc tách tự động con số nếu dạng REDEEM15-..., REDEEM-15K-...
      const match = code.match(/^REDEEM-?(\d+)/);
      if (match && match[1]) {
        const val = parseInt(match[1], 10);
        amount = val < 1000 ? val * 1000 : val;
      }
    }

    if (amount > 0) {
      const finalDiscount = Math.min(amount, subtotal);
      return {
        valid: true,
        code,
        discountAmount: finalDiscount,
        title: `Mã giảm giá từ đổi điểm (${amount.toLocaleString('vi-VN')}đ)`,
      };
    }
  }

  // 3. DANH SÁCH MÃ MẶC ĐỊNH HỆ THỐNG CỐ ĐỊNH
  const SYSTEM_PROMOS: Record<
    string,
    {
      amount: number;
      minSubtotal?: number;
      title: string;
      type?: 'FIXED' | 'PERCENT';
      value?: number;
      maxDiscount?: number;
    }
  > = {
    WELCOME10: { amount: 10000, minSubtotal: 50000, title: 'Giảm 10k cho đơn từ 50k' },
    BREW20: { amount: 20000, minSubtotal: 100000, title: 'Giảm 20k cho đơn từ 100k' },
    DISCOUNT10: {
      type: 'PERCENT',
      value: 10,
      maxDiscount: 30000,
      amount: 0,
      minSubtotal: 30000,
      title: 'Giảm 10% tối đa 30k',
    },
  };

  const promo = SYSTEM_PROMOS[code];
  if (promo) {
    if (promo.minSubtotal && subtotal < promo.minSubtotal) {
      throw new BadRequestException(
        `Đơn hàng cần tối thiểu ${promo.minSubtotal.toLocaleString('vi-VN')} đ để áp dụng mã ${code}`,
      );
    }

    let discountAmount = promo.amount;
    if (promo.type === 'PERCENT' && promo.value) {
      discountAmount = Math.round((subtotal * promo.value) / 100);
      if (promo.maxDiscount && discountAmount > promo.maxDiscount) {
        discountAmount = promo.maxDiscount;
      }
    }

    return {
      valid: true,
      code,
      discountAmount: Math.min(discountAmount, subtotal),
      title: promo.title,
    };
  }

  throw new BadRequestException(`Mã ưu đãi "${code}" không hợp lệ hoặc không tồn tại`);
}