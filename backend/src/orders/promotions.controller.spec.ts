import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PromotionDiscount } from './order-discount';
import { PromotionsController } from './promotions.controller';

describe('PromotionsController', () => {
  const prisma = {
    $transaction: (callback: (tx: object) => Promise<number>) => callback({}),
  } as unknown as PrismaService;
  const controller = new PromotionsController(prisma, new PromotionDiscount());

  it('previews the same promotion discount used when creating an order', async () => {
    await expect(controller.validate({ code: ' welcome10 ', subtotal: 90000 }))
      .resolves.toEqual({ code: 'WELCOME10', discount: 10000 });
    await expect(controller.validate({ code: 'discount10', subtotal: 50000 }))
      .resolves.toEqual({ code: 'DISCOUNT10', discount: 5000 });
  });

  it('rejects blank, unknown, and ineligible codes', async () => {
    await expect(controller.validate({ code: '   ', subtotal: 90000 }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.validate({ code: 'BREW10', subtotal: 90000 }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(controller.validate({ code: 'WELCOME10', subtotal: 10000 }))
      .rejects.toBeInstanceOf(BadRequestException);
  });
});
