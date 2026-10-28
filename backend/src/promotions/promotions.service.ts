import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { resolveVoucher } from './voucher-rules';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(code: string, subtotal: number, userId?: string) {
    try {
      // 💡 Truyền đúng tham số vị trí thứ 3 là this.prisma
      return await resolveVoucher(code, subtotal, this.prisma, userId);
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      console.error('❌ PROMOTIONS VALIDATE ERROR:', error?.message || error);
      throw new BadRequestException(
        error?.message || 'Không thể xác thực mã khuyến mãi lúc này.',
      );
    }
  }
}