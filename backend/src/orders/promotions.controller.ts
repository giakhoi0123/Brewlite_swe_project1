import { BadRequestException, Body, Controller, Inject, Post } from '@nestjs/common';
import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma.service';
import { ORDER_DISCOUNT, type OrderDiscount } from './order-discount';

export class ValidatePromotionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  code: string;

  @IsInt()
  @Min(0)
  @Max(1_000_000_000)
  subtotal: number;
}

@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ORDER_DISCOUNT) private readonly discount: OrderDiscount,
  ) {}

  @Post('validate')
  async validate(@Body() dto: ValidatePromotionDto) {
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Vui lòng nhập mã ưu đãi');
    const discount = await this.prisma.$transaction((tx) =>
      this.discount.calculate(tx, { userId: '', subtotal: dto.subtotal, promotionCode: code }),
    );
    return { code, discount };
  }
}
