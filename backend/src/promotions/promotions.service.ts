import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { resolveVoucher } from './voucher-rules';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(code: string, subtotal: number = 0) {
    const res = await resolveVoucher(code, subtotal, this.prisma);
    return {
      ...res,
      discount: res.discountAmount,
      amount: res.discountAmount,
    };
  }
}