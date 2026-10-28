import { BadRequestException } from '@nestjs/common';

export interface VoucherResult {
  valid: boolean;
  code: string;
  discountAmount: number;
  discountValue?: number;
  discount?: number;
  amount?: number;
  title: string;
  promotionId?: string;
}

export async function resolveVoucher(
  codeRaw: string,
  subtotal: number,
  prismaClient: any,
  userId?: string,
): Promise<VoucherResult> {
  if (!codeRaw || !codeRaw.trim()) {
    return { valid: true, code: '', discountAmount: 0, title: '' };
  }

  if (!prismaClient) {
    throw new BadRequestException('Không thể xác thực mã giảm giá do thiếu truy vấn cơ sở dữ liệu');
  }

  const code = codeRaw.trim().toUpperCase();
  let promotion: any = null;

  const db = prismaClient as any;
  const promotionModel = db.promotion || db.promotions;
  const userCouponModel = db.userCoupon || db.user_coupon || db.userCoupons;
  const couponModel = db.coupon || db.coupons || db.voucher || db.vouchers;

  // 1. TRA CỨU KHUYẾN MÃI DỰA TRÊN CÁC BẢNG HIỆN CÓ (US11)
  if (promotionModel) {
    try {
      promotion = await promotionModel.findFirst({
        where: { code: { equals: code, mode: 'insensitive' } },
      });
    } catch (e) {
      try {
        promotion = await promotionModel.findFirst({ where: { code } });
      } catch (err) {}
    }
  }

  if (!promotion && userCouponModel) {
    try {
      const coupon = await userCouponModel.findFirst({
        where: { code: { equals: code, mode: 'insensitive' }, isUsed: false },
      });
      if (coupon) {
        promotion = {
          id: coupon.id,
          code: coupon.code,
          discountValue: coupon.discountValue || coupon.discountAmount || coupon.discount || 0,
          discountType: 'FIXED_AMOUNT',
          minOrderValue: 0,
          isActive: true,
          description: `Voucher giảm ${Number(coupon.discountValue || 0).toLocaleString('vi-VN')}đ`,
        };
      }
    } catch (e) {
      try {
        const coupon = await userCouponModel.findFirst({ where: { code } });
        if (coupon) {
          promotion = {
            id: coupon.id,
            code: coupon.code,
            discountValue: coupon.discountValue || coupon.discountAmount || coupon.discount || 0,
            discountType: 'FIXED_AMOUNT',
            minOrderValue: 0,
            isActive: true,
            description: `Voucher giảm ${Number(coupon.discountValue || 0).toLocaleString('vi-VN')}đ`,
          };
        }
      } catch (err) {}
    }
  }

  if (!promotion && couponModel) {
    try {
      const c = await couponModel.findFirst({
        where: { code: { equals: code, mode: 'insensitive' } },
      });
      if (c) {
        promotion = {
          id: c.id,
          code: c.code,
          discountValue: c.discount || c.discountValue || c.discountAmount || 0,
          discountType: 'FIXED_AMOUNT',
          minOrderValue: 0,
          isActive: !c.isUsed,
          description: `Voucher giảm ${Number(c.discount || c.discountValue || 0).toLocaleString('vi-VN')}đ`,
        };
      }
    } catch (e) {}
  }

  if (!promotion) {
    throw new BadRequestException(`Mã ưu đãi "${code}" không tồn tại trên hệ thống`);
  }

  // 2. KIỂM TRA ĐIỀU KIỆN KÍCH HOẠT
  if (promotion.isActive === false) {
    throw new BadRequestException(`Mã ưu đãi "${code}" hiện đang bị khóa hoặc ngưng áp dụng`);
  }

  // 3. KIỂM TRA HẠN SỬ DỤNG
  const now = new Date();
  if (promotion.startDate && new Date(promotion.startDate) > now) {
    throw new BadRequestException(`Mã ưu đãi "${code}" chưa đến thời gian sử dụng`);
  }
  if (promotion.endDate && new Date(promotion.endDate) < now) {
    throw new BadRequestException(`Mã ưu đãi "${code}" đã hết hạn sử dụng`);
  }

  // 4. KIỂM TRA GIỚI HẠN SỐ LẦN SỬ DỤNG
  if (
    promotion.usageLimit !== null &&
    promotion.usageLimit !== undefined &&
    promotion.usageCount >= promotion.usageLimit
  ) {
    throw new BadRequestException(`Mã ưu đãi "${code}" đã hết lượt sử dụng`);
  }

  // 5. KIỂM TRA GIÁ TRỊ ĐƠN HÀNG TỐI THIỂU
  const safeSubtotal = Number(subtotal || 0);
  const minOrderValue = Number(promotion.minOrderValue || 0);
  if (minOrderValue > 0 && safeSubtotal < minOrderValue) {
    throw new BadRequestException(
      `Đơn hàng cần tối thiểu ${minOrderValue.toLocaleString('vi-VN')}đ để áp dụng mã "${code}"`,
    );
  }

  // 6. TÍNH SỐ TIỀN GIẢM GIÁ (AN TOÀN CHỐNG NaN 100%)
  let rawDiscount = Number(
    promotion.discountValue ?? promotion.discountAmount ?? promotion.discount ?? 0,
  );
  if (isNaN(rawDiscount)) {
    rawDiscount = 0;
  }

  const maxDiscountAmount = Number(promotion.maxDiscountAmount || 0);
  let computedDiscount = 0;

  if (promotion.discountType === 'PERCENTAGE' || promotion.discountType === 'PERCENT') {
    computedDiscount = Math.round((safeSubtotal * rawDiscount) / 100);
    if (maxDiscountAmount > 0 && computedDiscount > maxDiscountAmount) {
      computedDiscount = maxDiscountAmount;
    }
  } else {
    computedDiscount = rawDiscount;
  }

  const finalDiscount = Math.max(0, Math.min(computedDiscount, safeSubtotal));

  // 7. TRẢ VỀ ĐẦY ĐỦ ALIAS ĐỂ FRONTEND KHÔNG BỊ TRUY VẤN UNDEFINED / NaN
  return {
    valid: true,
    code: promotion.code,
    discountAmount: finalDiscount,
    discountValue: finalDiscount,
    discount: finalDiscount,
    amount: finalDiscount,
    title: promotion.description || `Mã giảm ${finalDiscount.toLocaleString('vi-VN')}đ`,
    promotionId: promotion.id,
  };
}