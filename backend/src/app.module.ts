import { Module, NotFoundException } from '@nestjs/common';
import { OrderStatus, type Prisma } from '@prisma/client';
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
import { LoyaltyModule } from './loyalty/loyalty.module';
import { PromotionsModule } from './promotions/promotions.module';
import {
  PAYMENT_ORDER_PORT,
  type PaymentOrderPort,
} from './payments/payment.types';
import { cartConfigKey, normalizeToppingIds } from './cart/cart-pricing';

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
    LoyaltyModule,
    PromotionsModule,
    PaymentsModule.register({
      imports: [OrdersModule, PrismaModule],
      orderProvider: {
        provide: PAYMENT_ORDER_PORT,
        useFactory: (
          orders: OrdersService,
          prisma: PrismaService,
        ): PaymentOrderPort => ({
          async findOwned(id, userId, transaction) {
            if (transaction) {
              return transaction.order.findFirst({
                where: { id, userId },
                select: { id: true, userId: true, total: true, status: true },
              });
            }
            return prisma.order.findFirst({
              where: { id, userId },
              select: { id: true, userId: true, total: true, status: true },
            });
          },
          async prepareRetry(id, userId, transaction) {
            return orders.preparePaymentRetry(id, userId, transaction);
          },
          async applyPaymentResult(input, transaction) {
            const apply = async (tx: Prisma.TransactionClient) => {
              const order = await tx.order.findFirst({
                where: { id: input.orderId, userId: input.userId },
                select: { id: true, userId: true, total: true },
              });
              if (!order)
                throw new NotFoundException('Không tìm thấy đơn hàng');

              const targetStatus =
                input.status === 'PAID'
                  ? OrderStatus.PAID
                  : OrderStatus.PAYMENT_FAILED;
              await orders.transitionInTransaction(
                tx,
                input.orderId,
                targetStatus,
              );

              if (input.status === 'PAID') {
                const pointsToEarn = Math.floor(order.total / 10000);

                if (pointsToEarn > 0) {
                  const existingLog = await tx.loyaltyLog.findUnique({
                    where: { orderId: order.id },
                  });
                  if (!existingLog) {
                    await tx.loyaltyLog.create({
                      data: {
                        userId: order.userId,
                        orderId: order.id,
                        points: pointsToEarn,
                      },
                    });
                  }
                }

                // Scoped cart cleanup: Không xóa toàn bộ CartItem nếu có món mới được thêm trong lúc chờ
                const orderWithItems = await tx.order.findUnique({
                  where: { id: input.orderId },
                  include: {
                    items: {
                      include: {
                        toppings: true,
                      },
                    },
                  },
                });

                const cart = await tx.cart.findUnique({
                  where: { userId: order.userId },
                  include: { items: true },
                });

                if (cart && orderWithItems) {
                  for (const item of orderWithItems.items) {
                    const toppingIds = normalizeToppingIds(
                      item.toppings.map((t) => t.toppingId),
                    );
                    const configKey = cartConfigKey({
                      size: item.size,
                      toppingIds,
                      ice: item.ice,
                      sugar: item.sugar,
                      note: item.note ?? '',
                    });
                    const cartItem = cart.items.find(
                      (ci) =>
                        ci.productId === item.productId &&
                        ci.configKey === configKey,
                    );
                    if (cartItem) {
                      if (cartItem.quantity <= item.qty) {
                        await tx.cartItem.delete({
                          where: { id: cartItem.id },
                        });
                      } else {
                        await tx.cartItem.update({
                          where: { id: cartItem.id },
                          data: { quantity: { decrement: item.qty } },
                        });
                      }
                    }
                  }
                }
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
