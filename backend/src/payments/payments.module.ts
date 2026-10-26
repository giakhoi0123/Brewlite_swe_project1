import type { DynamicModule, ModuleMetadata, Provider } from '@nestjs/common';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PAYMENT_GATEWAY } from './payment.types';
import { PaymentsController } from './payments.controller';
import { PaymentsRepository } from './payments.repository';
import { PaymentsService } from './payments.service';
import { VnpayGateway } from './vnpay.gateway';

type PaymentsModuleOptions = {
  imports?: ModuleMetadata['imports'];
  orderProvider: Provider;
};

@Module({})
export class PaymentsModule {
  static register(options: PaymentsModuleOptions): DynamicModule {
    return {
      module: PaymentsModule,
      imports: [AuthModule, ...(options.imports ?? [])],
      controllers: [PaymentsController],
      providers: [
        options.orderProvider,
        PaymentsRepository,
        PaymentsService,
        VnpayGateway,
        { provide: PAYMENT_GATEWAY, useExisting: VnpayGateway },
      ],
      exports: [PaymentsService],
    };
  }
}
