import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  async redeem(
    @Body() body: { pointsToRedeem: number; discountAmount: number; minOrderValue?: number },
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.userId || req.user?.sub;
    const points = Number(body.pointsToRedeem);
    const discount = Number(body.discountAmount);
    const minOrder = Number(body.minOrderValue || 0);

    return this.loyaltyService.redeemPoints(userId, points, discount, minOrder);
  }
}