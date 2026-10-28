import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard'; // Sử dụng JwtAuthGuard sẵn có

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  async validate(@Body() body: Record<string, any>, @Req() req: any) {
    const safeBody = body || {};
    const code = String(safeBody.code || safeBody.couponCode || '').trim();
    const subtotal = Number(safeBody.subtotal || safeBody.total || 0);
    const userId = req.user?.id || req.user?.userId || req.user?.sub;

    return this.promotionsService.validate(code, subtotal, userId);
  }
}