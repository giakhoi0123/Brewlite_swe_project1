import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RedeemRewardDto } from './dto/redeem-reward.dto';

@Controller('loyalty')
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  async redeem(@Body() body: RedeemRewardDto, @Req() req: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.loyaltyService.redeemReward(userId, body.rewardId);
  }

  @Get('vouchers')
  @UseGuards(JwtAuthGuard)
  async getVouchers(@Req() req: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.loyaltyService.getAvailableVouchers(userId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMyPoints(@Req() req: any) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.loyaltyService.getMyPoints(userId);
  }
}
