import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller';
import { PromotionsService } from './promotions.service';
import { ORDER_DISCOUNT } from '../orders/order-discount';

@Module({
  controllers: [PromotionsController],
  providers: [
    PromotionsService,
    {
      provide: ORDER_DISCOUNT,
      useExisting: PromotionsService,
    },
  ],
  exports: [PromotionsService, ORDER_DISCOUNT],
})
export class PromotionsModule {}