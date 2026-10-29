import { randomBytes } from 'node:crypto';
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { REWARDS } from './rewards';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Đổi điểm lấy Voucher cá nhân an toàn (Client chỉ được gửi rewardId).
   * Backend xác định: điểm, tiền giảm, min order value, giới hạn.
   * Concurrency-safe: updateMany gte points.
   */
  async redeemReward(userId: string, rewardId: string) {
    if (!userId) {
      throw new BadRequestException('ID người dùng không hợp lệ');
    }

    const reward = REWARDS[rewardId];
    if (!reward) {
      throw new BadRequestException('Gói đổi thưởng không tồn tại trên hệ thống');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Trừ điểm nguyên tử có điều kiện số dư đủ
      const updatedUser = await tx.user.updateMany({
        where: {
          id: userId,
          loyaltyPoints: { gte: reward.pointsCost },
        },
        data: {
          loyaltyPoints: { decrement: reward.pointsCost },
        },
      });

      if (updatedUser.count === 0) {
        throw new BadRequestException('Điểm tích lũy không đủ để đổi ưu đãi này.');
      }

      // 2. Sinh mã voucher ngẫu nhiên an toàn
      const randomSuffix = randomBytes(4).toString('hex').toUpperCase();
      const voucherCode = `REDEEM-${reward.pointsCost}P-${randomSuffix}`;

      // 3. Lưu voucher vào PostgreSQL với quyền sở hữu userId và trạng thái AVAILABLE
      const voucher = await tx.voucher.create({
        data: {
          code: voucherCode,
          userId,
          rewardId: reward.id,
          title: reward.title,
          description: reward.description,
          discountAmount: reward.discountAmount,
          minOrderValue: reward.minOrderValue,
          status: 'AVAILABLE',
        },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { loyaltyPoints: true },
      });

      return {
        success: true,
        voucherCode: voucher.code,
        code: voucher.code,
        title: voucher.title,
        discountAmount: voucher.discountAmount,
        minOrderValue: voucher.minOrderValue,
        remainingPoints: user?.loyaltyPoints ?? 0,
      };
    });
  }

  /**
   * Lấy danh sách voucher KHẢ DỤNG (AVAILABLE) từ PostgreSQL
   */
  async getAvailableVouchers(userId: string) {
    if (!userId) {
      throw new BadRequestException('Không xác định được thông tin tài khoản');
    }

    const vouchers = await this.prisma.voucher.findMany({
      where: {
        userId,
        status: 'AVAILABLE',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        discountAmount: true,
        minOrderValue: true,
        status: true,
        createdAt: true,
      },
    });

    return vouchers.map((v) => ({
      id: v.id,
      code: v.code,
      title: v.title,
      description: v.description,
      discountAmount: v.discountAmount,
      minOrderValue: v.minOrderValue,
      status: v.status,
      isUsed: false,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  async getMyPoints(userId: string) {
    if (!userId) {
      throw new BadRequestException('Không xác định được thông tin tài khoản');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { loyaltyPoints: true },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng');
    }

    return { points: user.loyaltyPoints };
  }
}
