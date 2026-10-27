import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * US12: ĐỔI ĐIỂM AN TOÀN NGUYÊN TỬ (ATOMIC TRANSACTION)
   * US11: ÁP DỤNG ĐIỀU KIỆN ĐƠN HÀNG TỐI THIỂU (MIN ORDER VALUE)
   */
  async redeemPoints(
    userId: string,
    pointsToRedeem: number,
    discountAmount?: number,
    minOrderValue?: number,
  ) {
    if (!userId) {
      throw new BadRequestException('ID người dùng không hợp lệ');
    }

    let points = Number(pointsToRedeem);
    let discount = Number(discountAmount);

    // 1. Đồng bộ chuẩn xác 2 chiều giữa số điểm (points) và số tiền giảm (discount)
    if (discount > 0) {
      if (discount >= 50000) points = 200;
      else if (discount >= 20000) points = 100;
      else if (discount >= 10000) points = 50;
    } else if (points > 0) {
      if (points >= 200) discount = 50000;
      else if (points >= 100) discount = 20000;
      else if (points >= 50) discount = 10000;
      else discount = points * 200;
    } else {
      throw new BadRequestException('Thông tin đổi điểm không hợp lệ');
    }

    if (!points || isNaN(points) || points <= 0) {
      throw new BadRequestException('Số điểm đổi phải lớn hơn 0');
    }

    // 2. Tự động suy luận minOrderValue (Gói >= 50k áp dụng đơn 100k, gói nhỏ hơn áp dụng 0đ)
    let minOrder = minOrderValue !== undefined && minOrderValue !== null ? Number(minOrderValue) : -1;
    if (minOrder < 0) {
      minOrder = discount >= 50000 ? 100000 : 0;
    }

    try {
      // 3. GIAO DỊCH NGUYÊN TỬ (ATOMIC TRANSACTION)
      const result = await this.prisma.$transaction(async (tx) => {
        // Trừ đúng số điểm người dùng đã được đồng bộ
        const updatedUser = await tx.user.updateMany({
          where: {
            id: userId,
            loyaltyPoints: { gte: points },
          },
          data: {
            loyaltyPoints: { decrement: points },
          },
        });

        if (updatedUser.count === 0) {
          throw new BadRequestException(
            'Số điểm tích lũy không đủ hoặc đang có giao dịch xử lý đồng thời.',
          );
        }

        // Sinh mã động chuẩn theo số điểm đã được đồng bộ (REDEEM-200P-..., REDEEM-100P-..., REDEEM-50P-...)
        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
        const voucherCode = `REDEEM-${points}P-${randomSuffix}`;

        const description = minOrder > 0
          ? `Voucher giảm ${discount.toLocaleString('vi-VN')}đ cho đơn từ ${minOrder.toLocaleString('vi-VN')}đ`
          : `Voucher giảm ${discount.toLocaleString('vi-VN')}đ (Áp dụng mọi đơn hàng)`;

        // Tạo bản ghi Promotion trực tiếp trong Transaction (Nếu lỗi sẽ rollback trừ điểm)
        const db = tx as any;
        await db.promotion.create({
          data: {
            code: voucherCode,
            name: `Voucher giảm ${discount.toLocaleString('vi-VN')}đ`,
            description,
            discountType: 'FIXED_AMOUNT',
            discountValue: discount,
            minOrderValue: minOrder,
            isActive: true,
          },
        });

        // Lấy lại số điểm còn lại sau khi trừ
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { loyaltyPoints: true },
        });

        return {
          voucherCode,
          remainingPoints: user?.loyaltyPoints ?? 0,
        };
      });

      console.log(`[PROMOTION CREATED]: ${result.voucherCode} (Points: ${points}, Discount: ${discount}đ, MinOrder: ${minOrder}đ)`);

      // 4. Trả về Response chứa đầy đủ Alias hỗ trợ Frontend
      return {
        success: true,
        voucherCode: result.voucherCode,
        code: result.voucherCode,
        couponCode: result.voucherCode,
        discountAmount: discount,
        remainingPoints: result.remainingPoints,
        minOrderValue: minOrder,
        coupon: { code: result.voucherCode, discountValue: discount, minOrderValue: minOrder },
        data: {
          voucherCode: result.voucherCode,
          code: result.voucherCode,
          couponCode: result.voucherCode,
          discountAmount: discount,
          remainingPoints: result.remainingPoints,
          minOrderValue: minOrder,
        },
      };
    } catch (error: any) {
      if (
        error instanceof BadRequestException ||
        error instanceof ForbiddenException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }
      console.error('[REDEEM ERROR LOG]:', error);
      throw new InternalServerErrorException(
        error?.message || 'Có lỗi xảy ra khi xử lý đổi điểm',
      );
    }
  }

  /**
   * LẤY DANH SÁCH VOUCHER KHẢ DỤNG (TỰ ĐỘNG LỌC BỎ CÁC MÃ ĐÃ DÙNG TRONG BẢNG ORDER)
   */
  async getVouchers(userId: string) {
    if (!userId) {
      throw new BadRequestException('Không xác định được thông tin tài khoản');
    }

    // A. Lấy danh sách tất cả mã promotionCode đã được dùng trong Order
    const usedOrders = await this.prisma.order.findMany({
      where: {
        userId,
        promotionCode: { not: null },
        status: { notIn: ['CANCELLED', 'PAYMENT_FAILED'] },
      },
      select: { promotionCode: true },
    });

    const usedCodesSet = new Set(
      usedOrders
        .map((o) => o.promotionCode?.trim().toUpperCase())
        .filter((c): c is string => Boolean(c)),
    );

    // B. Lấy danh sách các khuyến mãi đang kích hoạt trong hệ thống (Ép kiểu as any để tránh lỗi Type definition)
    const db = this.prisma as any;
    const promotions: any[] = await db.promotion.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    // C. Lọc ra các voucher chưa bị sử dụng bởi user này
    const availablePromotions = promotions.filter(
      (p: any) => !usedCodesSet.has(p.code.trim().toUpperCase()),
    );

    return availablePromotions.map((p: any) => ({
      id: p.id,
      code: p.code,
      title: p.name,
      discountAmount: p.discountValue,
      description: p.description,
      minOrderValue: p.minOrderValue,
      status: 'UNUSED',
      isUsed: false,
    }));
  }

  async getUserPoints(targetUserId: string, requestingUserId: string, userRole?: string) {
    if (!targetUserId) {
      throw new BadRequestException('Mã người dùng không được để trống');
    }

    if (requestingUserId !== targetUserId && userRole !== 'ADMIN' && userRole !== 'BARISTA') {
      throw new ForbiddenException('Bạn không có quyền xem thông tin điểm tích lũy của người dùng khác');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true, loyaltyPoints: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    return user;
  }
}