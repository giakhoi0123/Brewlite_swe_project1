import { Module, NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderStatus, type Prisma } from '@prisma/client';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import configuration from './configuration';
import { BaristaController } from './barista/barista.controller';
import { OrdersModule } from './orders/orders.module';
import { OrdersService } from './orders/orders.service';
import { InventoryModule } from './inventory/inventory.module';
import { PaymentsModule } from './payments/payments.module';
import {
  PAYMENT_ORDER_PORT,
  type PaymentOrderPort,
} from './payments/payment.types';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../.env', '.env'],
      load: [configuration],
    }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CartModule,
    InventoryModule,
    OrdersModule,
    PaymentsModule.register({
      imports: [OrdersModule, PrismaModule],
      orderProvider: {
        provide: PAYMENT_ORDER_PORT,
        useFactory: (
          orders: OrdersService,
          prisma: PrismaService,
        ): PaymentOrderPort => ({
          async findOwned(id, userId) {
            return orders.get(id, userId);
          },
          async prepareRetry(id, userId, transaction) {
            return orders.preparePaymentRetry(id, userId, transaction);
          },
          async applyPaymentResult(input, transaction) {
            const apply = async (tx: Prisma.TransactionClient) => {
              const owned = await tx.order.findFirst({
                where: { id: input.orderId, userId: input.userId },
                select: { id: true },
              });
              if (!owned)
                throw new NotFoundException('Không tìm thấy đơn hàng');
              if (input.status === 'UNKNOWN') return;

              const targetStatus =
                input.status === 'PAID'
                  ? OrderStatus.PAID
                  : OrderStatus.PAYMENT_FAILED;
              const order = await orders.transitionInTransaction(
                tx,
                input.orderId,
                targetStatus,
              );

              if (input.status === 'PAID') {
                const pointsToEarn = Math.floor(order.total / 10000);

                if (pointsToEarn > 0) {
                  await tx.user.update({
                    where: { id: input.userId },
                    data: {
                      loyaltyPoints: {
                        increment: pointsToEarn,
                      },
                    },
                  });
                }
              }
            };

            if (transaction) {
              await apply(transaction);
              return;
            }
            await prisma.$transaction(apply);
          },
        }),
        inject: [OrdersService, PrismaService],
      },
    }),
  ],
  controllers: [AppController, BaristaController],
  providers: [AppService],
})
export class AppModule {}
