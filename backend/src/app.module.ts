import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderStatus } from '@prisma/client';
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
import { PAYMENT_ORDER_PORT } from './payments/payment.types';

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
        useFactory: (orders: OrdersService, prisma: PrismaService) => ({
          async findOwned(id: string, userId: string) {
            return orders.get(id, userId);
          },
          async applyPaymentResult(input: {
            orderId: string;
            userId: string;
            method: string;
            status: 'SUCCESS' | 'FAILED' | 'UNKNOWN';
          }) {
            if (input.status === 'UNKNOWN') return;

            const targetStatus =
              input.status === 'SUCCESS'
                ? OrderStatus.PAID
                : OrderStatus.PAYMENT_FAILED;

            return prisma.$transaction(async (tx) => {
              const order = await orders.transitionInTransaction(
                tx,
                input.orderId,
                targetStatus,
              );

              if (input.status === 'SUCCESS') {
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

              return order;
            });
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