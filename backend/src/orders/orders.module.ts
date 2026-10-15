import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersController } from './orders.controller';
import { StaffOrdersController } from './staff-orders.controller';
import { OrdersService } from './orders.service';
import { NoPromotionDiscount, ORDER_DISCOUNT } from './order-discount';

@Module({
  imports: [AuthModule, PrismaModule, InventoryModule],
  controllers: [OrdersController, StaffOrdersController],
  providers: [
    OrdersService,
    { provide: ORDER_DISCOUNT, useClass: NoPromotionDiscount },
  ],
  exports: [OrdersService],
})
export class OrdersModule {}
