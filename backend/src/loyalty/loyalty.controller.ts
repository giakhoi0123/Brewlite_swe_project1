import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { LoyaltyService } from './loyalty.service';

@Controller('loyalty')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CUSTOMER)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('me')
  async getMine(@Req() req: { user: { userId: string } }) {
    return this.loyaltyService.getPoints(req.user.userId);
  }

  @Get(':userId')
  async getPoints(@Param('userId') userId: string) {
    return this.loyaltyService.getPoints(userId);
  }

  @Post('redeem')
  async redeem(
    @Req() req: { user: { userId: string } },
    @Body() body: { rewardOptionId?: string; id?: string; rewardId?: string; optionId?: string },
  ) {
    const userId = req.user.userId;
    const optionId =
      body?.rewardOptionId || body?.id || body?.rewardId || body?.optionId;

    if (!optionId) {
      throw new BadRequestException('Chưa xác định được gói quà muốn đổi');
    }

    return this.loyaltyService.redeem(userId, optionId);
  }
}