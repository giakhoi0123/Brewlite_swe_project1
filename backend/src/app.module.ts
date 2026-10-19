import { ConflictException, Module, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ConfigModule } from '@nestjs/config';
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
          async findOwned(id: string, userId: string) {
            return orders.get(id, userId);
          },
          async prepareAttempt(input, tx) {
            const owned = await tx.order.findFirst({
              where: { id: input.orderId, userId: input.userId },
            });
            if (!owned) throw new NotFoundException('Không tìm thấy đơn hàng');
            if (owned.status === 'PAYMENT_FAILED') {
              return orders.preparePaymentRetry(owned.id, input.userId, tx);
            }
            if (owned.status !== 'PENDING') {
              throw new ConflictException('Đơn hàng không thể thanh toán');
            }
            return owned;
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

              const order = await orders.transitionInTransaction(
                tx,
                input.orderId,
                input.status,
              );

              if (input.status === 'PAID') {
                const pointsToEarn = Math.floor(order.total / 10000);

                if (pointsToEarn > 0) {
                  await tx.loyaltyLog.create({
                    data: { userId: order.userId, orderId: order.id, points: pointsToEarn },
                  });
                  await tx.user.update({
                    where: { id: order.userId },
                    data: {
                      loyaltyPoints: {
                        increment: pointsToEarn,
                      },
                    },
                  });
                }
                await tx.cartItem.deleteMany({ where: { cart: { userId: order.userId } } });
              }
            };
            if (transaction) await apply(transaction);
            else await prisma.$transaction(apply);
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
