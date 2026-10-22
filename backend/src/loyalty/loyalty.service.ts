import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Hàm lấy điểm thưởng mới nhất từ CSDL PostgreSQL
  async getPoints(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { loyaltyPoints: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    return { points: user.loyaltyPoints };
  }

  // 2. Hàm đổi điểm lấy mã voucher
  async redeem(userId: string, rewardOptionId: string) {
    if (!userId) {
      throw new BadRequestException('Không xác định được thông tin tài khoản');
    }

    const REWARDS: Record<string, { pointsCost: number; discountAmount: number; title: string }> = {
      'rw-10k': { pointsCost: 50, discountAmount: 10000, title: 'Voucher Giảm 10.000đ' },
      'rw-20k': { pointsCost: 100, discountAmount: 20000, title: 'Voucher Giảm 20.000đ' },
      'rw-50k': { pointsCost: 200, discountAmount: 50000, title: 'Voucher Giảm 50.000đ' },
      '10k': { pointsCost: 50, discountAmount: 10000, title: 'Voucher Giảm 10.000đ' },
      '20k': { pointsCost: 100, discountAmount: 20000, title: 'Voucher Giảm 20.000đ' },
      '50k': { pointsCost: 200, discountAmount: 50000, title: 'Voucher Giảm 50.000đ' },
    };

    const reward = REWARDS[rewardOptionId];
    if (!reward) {
      throw new BadRequestException('Gói quà không hợp lệ');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    if (user.loyaltyPoints < reward.pointsCost) {
      throw new BadRequestException(`Bạn không đủ điểm để đổi ${reward.title}`);
    }

    // Trừ điểm trực tiếp trong CSDL PostgreSQL
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        loyaltyPoints: { decrement: reward.pointsCost },
      },
    });

    // 💡 TỰ ĐỘNG CHÈN TIỀN TỐ MỆNH GIÁ (10000 -> 10, 20000 -> 20, 50000 -> 50)
    const kiloValue = Math.round(reward.discountAmount / 1000);
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();

    // Sinh mã dạng: REDEEM10-A8B9C0, REDEEM20-X1Y2Z3, REDEEM50-P9Q8R7
    const code = `REDEEM${kiloValue}-${randomSuffix}`;

    // Tạo cấu trúc Voucher hoàn chỉnh
    const newVoucher = {
      id: code,
      code: code,
      title: reward.title,
      discountAmount: reward.discountAmount,
      description: `Mã giảm ${reward.discountAmount.toLocaleString('vi-VN')}đ cho mọi đơn hàng`,
      minOrderValue: reward.discountAmount === 50000 ? 100000 : 0,
      expiryDate: '31/12/2026',
      status: 'UNUSED',
      isUsed: false,
    };

    // 💡 LƯU LỊCH SỬ ĐỔI VOUCHER VÀO CSDL (NẾU BẢNG TỒN TẠI)
    try {
      const db = this.prisma as any;
      if (db.loyaltyTransaction) {
        await db.loyaltyTransaction.create({
          data: {
            userId,
            code,
            amount: reward.discountAmount,
            discountValue: reward.discountAmount,
            title: reward.title,
            isUsed: false,
            status: 'UNUSED',
          },
        });
      } else if (db.userCoupon) {
        await db.userCoupon.create({
          data: {
            userId,
            code,
            discountAmount: reward.discountAmount,
            title: reward.title,
            isUsed: false,
            status: 'UNUSED',
          },
        });
      }
    } catch (e) {
      // Bỏ qua nếu chưa khai báo bảng phụ trong schema
    }

    return {
      success: true,
      message: `Đổi thành công mã ${code}`,
      code: code,
      voucher: newVoucher,
      remainingPoints: updatedUser.loyaltyPoints,
    };
  }

  // 3. HÀM LẤY DANH SÁCH VOUCHER KHẢ DỤNG (TỰ ĐỘNG LỌC BỎ CÁC MÃ ĐÃ DÙNG TRONG BẢNG ORDER)
  async getVouchers(userId: string) {
    if (!userId) {
      throw new BadRequestException('Không xác định được thông tin tài khoản');
    }

    // A. Lấy danh sách tất cả mã promotionCode đã từng được dùng để đặt hàng thành công / đang xử lý
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

    // B. Lấy danh sách voucher từ CSDL (nếu có)
    const db = this.prisma as any;
    let savedVouchers: any[] = [];

    try {
      if (db.loyaltyTransaction) {
        savedVouchers = await db.loyaltyTransaction.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
      } else if (db.userCoupon) {
        savedVouchers = await db.userCoupon.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });
      }
    } catch (e) {
      // Bỏ qua lỗi query DB nếu chưa có bảng
    }

    // C. Kiểm tra trạng thái & LỌC BỎ các mã nằm trong tập usedCodesSet
    return savedVouchers
      .map((v) => {
        const codeUpper = (v.code || '').toUpperCase();
        const isUsed =
          v.isUsed || v.status === 'USED' || usedCodesSet.has(codeUpper);

        return {
          id: v.id || v.code,
          code: v.code,
          title: v.title || `Voucher Giảm ${(v.amount || v.discountAmount)?.toLocaleString('vi-VN')}đ`,
          discountAmount: v.amount || v.discountAmount,
          description: `Mã giảm ${(v.amount || v.discountAmount)?.toLocaleString('vi-VN')}đ cho mọi đơn hàng`,
          status: isUsed ? 'USED' : 'UNUSED',
          isUsed,
        };
      })
      .filter((v) => !v.isUsed); // 👈 TỰ ĐỘNG BIẾN MẤT VOUCHER ĐÃ SỬ DỤNG
  }
}
