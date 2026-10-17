import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  async validate(
    @Body() body: { code?: string; promotionCode?: string; subtotal?: number },
  ) {
    const code = body?.code || body?.promotionCode;
    if (!code) {
      throw new BadRequestException('Mã ưu đãi không được để trống');
    }
    return this.promotionsService.validate(code, body?.subtotal || 0);
  }
}