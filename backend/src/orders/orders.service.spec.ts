import { jest } from '@jest/globals';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from './orders.service';
import { PromotionDiscount } from './order-discount';
import type { CreateOrderDto } from './dto/create-order.dto';

describe('Orders service', () => {
  const productId = '10000000-0000-4000-8000-000000000001';
  const toppingId = '20000000-0000-4000-8000-000000000001';
  const product = () => ({
    id: productId,
    name: 'Bạc xỉu',
    imageUrl: '/coffee.svg',
    price: 29000,
    stock: 5,
    version: 1,
    sizes: [{ code: 'M', extraPrice: 5000, available: true }],
    toppings: [
      {
        toppingId,
        available: true,
        extraPrice: 6000,
        topping: { name: 'Kem sữa' },
      },
    ],
  });
  let products: ReturnType<typeof product>[];
  let dto: CreateOrderDto;
  const stockUpdate = jest.fn(async (_args: unknown) => ({ count: 1 }));
  const createOrder = jest.fn(async ({ data }: { data: any }) => ({
    id: 'order',
    user: { fullName: 'Orders test' },
    ...data,
    createdAt: new Date('2026-10-15T00:00:00Z'),
    items: data.items.create.map((i: any, index: number) => ({
      ...i,
      id: `item-${index}`,
      toppings: i.toppings.create,
    })),
  }));
  const findOrder = jest.fn<(...args: any[]) => Promise<any>>();
  const updateOrder = jest.fn(async (_args: unknown) => ({ count: 1 }));
  const history = jest.fn(async (_args: unknown) => ({}));
  const restore = jest.fn(async (_args: unknown) => ({}));
  const tx = {
    product: {
      findMany: jest.fn(async () => products),
      updateMany: stockUpdate,
      update: restore,
    },
    order: {
      create: createOrder,
      findUnique: findOrder,
      findUniqueOrThrow: findOrder,
      updateMany: updateOrder,
      findFirst: findOrder,
    },
    orderStatusHistory: { create: history },
  };
  let service: OrdersService;
  beforeEach(() => {
    jest.clearAllMocks();
    products = [product()];
    stockUpdate.mockResolvedValue({ count: 1 });
    updateOrder.mockResolvedValue({ count: 1 });
    dto = {
      items: [
        {
          productId,
          size: 'M',
          toppingIds: [toppingId],
          quantity: 2,
          ice: '70% đá',
          sugar: '50% ít ngọt',
          note: ' Ít nóng ',
        },
      ],
    };
    const prisma = {
      ...tx,
      $transaction: async (work: (db: unknown) => Promise<unknown>) => work(tx),
    } as unknown as PrismaService;
    service = new OrdersService(
      prisma,
      new InventoryService(),
      new PromotionDiscount(),
    );
  });

  it('calculates DB prices, creates PENDING, snapshots options and reserves stock', async () => {
    const result = await service.create('customer', dto);
    expect(result).toMatchObject({
      status: 'PENDING',
      subtotal: 80000,
      discount: 0,
      total: 80000,
    });
    expect(result.items[0]).toMatchObject({
      name: 'Bạc xỉu',
      unitPrice: 40000,
      quantity: 2,
      lineTotal: 80000,
      toppingNames: ['Kem sữa'],
      note: 'Ít nóng',
    });
    expect(stockUpdate).toHaveBeenCalledWith({
      where: { id: productId, version: 1, stock: { gte: 2 } },
      data: { stock: { decrement: 2 }, version: { increment: 1 } },
    });
    expect(createOrder.mock.calls[0][0].data.statusHistory.create).toEqual({
      toStatus: 'PENDING',
      version: 1,
    });
  });

  it.each([
    'empty',
    'missing product',
    'size',
    'unavailable size',
    'topping',
    'unavailable topping',
    'duplicate topping',
    'quantity',
  ])('rejects %s', async (scenario) => {
    if (scenario === 'empty') dto.items = [];
    if (scenario === 'missing product') products = [];
    if (scenario === 'size') dto.items[0].size = 'L';
    if (scenario === 'unavailable size') products[0].sizes[0].available = false;
    if (scenario === 'topping') dto.items[0].toppingIds = ['missing'];
    if (scenario === 'unavailable topping')
      products[0].toppings[0].available = false;
    if (scenario === 'duplicate topping')
      dto.items[0].toppingIds.push(toppingId);
    if (scenario === 'quantity') dto.items[0].quantity = 0;
    await expect(service.create('customer', dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(stockUpdate).not.toHaveBeenCalled();
    expect(createOrder).not.toHaveBeenCalled();
  });

  it.each(['insufficient', 'version conflict'])(
    'rejects %s stock without creating an order',
    async (scenario) => {
      if (scenario === 'insufficient') products[0].stock = 1;
      else stockUpdate.mockResolvedValue({ count: 0 });
      await expect(service.create('customer', dto)).rejects.toThrow(
        ConflictException,
      );
      expect(createOrder).not.toHaveBeenCalled();
    },
  );

  it('does not silently accept demo promotion codes', async () => {
    dto.promotionCode = 'BREW10';
    await expect(service.create('customer', dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(stockUpdate).not.toHaveBeenCalled();
  });

  it('bounds integer money before writing stock', async () => {
    products[0].price = 2147483647;
    await expect(service.create('customer', dto)).rejects.toThrow(
      BadRequestException,
    );
    expect(stockUpdate).not.toHaveBeenCalled();
  });

  it('hides other customers orders as 404', async () => {
    findOrder.mockResolvedValue(null);
    await expect(service.get('order', 'other')).rejects.toThrow(
      NotFoundException,
    );
    expect(findOrder).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'order', userId: 'other' } }),
    );
  });

  function order(status: OrderStatus, held = true) {
    return {
      id: 'order',
      status,
      version: 3,
      inventoryHeld: held,
      items: [{ productId, qty: 2 }],
    };
  }

  it.each(['CANCELLED', 'PAYMENT_FAILED'] as OrderStatus[])(
    'releases stock after winning order CAS for %s',
    async (to) => {
      findOrder.mockResolvedValue(order('PENDING'));
      await service.transitionInTransaction(
        tx as unknown as Prisma.TransactionClient,
        'order',
        to,
        to === 'CANCELLED' ? 'Hết nguyên liệu' : undefined,
      );
      expect(updateOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'order', status: 'PENDING', version: 3 },
        }),
      );
      expect(restore).toHaveBeenCalledTimes(1);
      expect(history).toHaveBeenCalledWith({
        data: {
          orderId: 'order',
          fromStatus: 'PENDING',
          toStatus: to,
          version: 4,
          createdAt: expect.any(Date),
        },
      });
    },
  );

  it('does not restore twice when cancelling a failed payment', async () => {
    findOrder.mockResolvedValue(order('PAYMENT_FAILED', false));
    await service.transitionInTransaction(
      tx as unknown as Prisma.TransactionClient,
      'order',
      'CANCELLED',
      'Khách yêu cầu hủy',
    );
    expect(restore).not.toHaveBeenCalled();
  });

  it('reacquires stock before retrying payment', async () => {
    findOrder.mockResolvedValue(order('PAYMENT_FAILED', false));
    await service.transitionInTransaction(
      tx as unknown as Prisma.TransactionClient,
      'order',
      'PENDING',
    );
    expect(stockUpdate).toHaveBeenCalledTimes(1);
    expect(restore).not.toHaveBeenCalled();
  });

  it('does not mutate inventory/history after losing order CAS', async () => {
    findOrder.mockResolvedValue(order('PENDING'));
    updateOrder.mockResolvedValue({ count: 0 });
    await expect(
      service.transitionInTransaction(
        tx as unknown as Prisma.TransactionClient,
        'order',
        'CANCELLED',
        'Hết nguyên liệu',
      ),
    ).rejects.toThrow(ConflictException);
    expect(restore).not.toHaveBeenCalled();
    expect(history).not.toHaveBeenCalled();
  });

  it('rejects skipped states and staff attempts to mark payment successful', async () => {
    findOrder.mockResolvedValue(order('PENDING'));
    await expect(
      service.transitionInTransaction(
        tx as unknown as Prisma.TransactionClient,
        'order',
        'PREPARING',
      ),
    ).rejects.toThrow(ConflictException);
    await expect(service.staffTransition('order', 'PAID')).rejects.toThrow(
      BadRequestException,
    );
    expect(updateOrder).not.toHaveBeenCalled();
  });
});
