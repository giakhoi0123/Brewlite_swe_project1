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
  voucherId?: string;
  isPersonalVoucher?: boolean;
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
  const safeSubtotal = Number(subtotal || 0);

  // 1. Kiểm tra trong bảng Voucher (Mã đổi điểm cá nhân)
  if (prismaClient.voucher) {
    const personalVoucher = await prismaClient.voucher.findUnique({
      where: { code },
    });

    if (personalVoucher) {
      if (userId && personalVoucher.userId !== userId) {
        throw new BadRequestException('Mã ưu đãi này không thuộc tài khoản của bạn');
      }

      if (personalVoucher.status !== 'AVAILABLE') {
        throw new BadRequestException(
          'Mã ưu đãi này đã được sử dụng hoặc đang chờ xử lý trong đơn hàng khác',
        );
      }

      const minOrder = Number(personalVoucher.minOrderValue || 0);
      if (minOrder > 0 && safeSubtotal < minOrder) {
        throw new BadRequestException(
          `Đơn hàng cần tối thiểu ${minOrder.toLocaleString('vi-VN')}đ để áp dụng mã "${code}"`,
        );
      }

      const discount = Math.max(0, Math.min(personalVoucher.discountAmount, safeSubtotal));

      return {
        valid: true,
        code: personalVoucher.code,
        discountAmount: discount,
        discountValue: discount,
        discount,
        amount: discount,
        title: personalVoucher.title,
        voucherId: personalVoucher.id,
        isPersonalVoucher: true,
      };
    }
  }

  // 2. Kiểm tra trong bảng Promotion (Chương trình khuyến mãi chung)
  let promotion = null;
  if (prismaClient.promotion) {
    promotion = await prismaClient.promotion.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    });
  }

  if (!promotion) {
    throw new BadRequestException(`Mã ưu đãi "${code}" không tồn tại trên hệ thống`);
  }

  if (promotion.isActive === false) {
    throw new BadRequestException(`Mã ưu đãi "${code}" hiện đang bị khóa hoặc ngưng áp dụng`);
  }

  const now = new Date();
  if (promotion.startDate && new Date(promotion.startDate) > now) {
    throw new BadRequestException(`Mã ưu đãi "${code}" chưa đến thời gian sử dụng`);
  }
  if (promotion.endDate && new Date(promotion.endDate) < now) {
    throw new BadRequestException(`Mã ưu đãi "${code}" đã hết hạn sử dụng`);
  }

  if (
    promotion.usageLimit !== null &&
    promotion.usageLimit !== undefined &&
    promotion.usageCount >= promotion.usageLimit
  ) {
    throw new BadRequestException(`Mã ưu đãi "${code}" đã hết lượt sử dụng`);
  }

  const minOrderValue = Number(promotion.minOrderValue || 0);
  if (minOrderValue > 0 && safeSubtotal < minOrderValue) {
    throw new BadRequestException(
      `Đơn hàng cần tối thiểu ${minOrderValue.toLocaleString('vi-VN')}đ để áp dụng mã "${code}"`,
    );
  }

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

  return {
    valid: true,
    code: promotion.code,
    discountAmount: finalDiscount,
    discountValue: finalDiscount,
    discount: finalDiscount,
    amount: finalDiscount,
    title: promotion.description || `Mã giảm ${finalDiscount.toLocaleString('vi-VN')}đ`,
    promotionId: promotion.id,
    isPersonalVoucher: false,
  };
}
