import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import configuration from './configuration';
import { BaristaController } from './barista/barista.controller';
import { OrdersModule } from './orders/orders.module';
import { InventoryModule } from './inventory/inventory.module';

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
  ],
  controllers: [AppController, BaristaController],
  providers: [AppService],
})
export class AppModule {}
