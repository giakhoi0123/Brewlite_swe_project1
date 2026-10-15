import { jest } from '@jest/globals';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService } from './inventory.service';

describe('Inventory optimistic locking', () => {
  const inventory = new InventoryService();

  it('aggregates configurations of one product before checking available stock', async () => {
    const updateMany = jest.fn();
    const tx = {
      product: { updateMany },
    } as unknown as Prisma.TransactionClient;
    await expect(
      inventory.reserve(
        tx,
        [
          { productId: 'a', qty: 2 },
          { productId: 'a', qty: 2 },
        ],
        [{ id: 'a', stock: 3, version: 1 }],
      ),
    ).rejects.toThrow(ConflictException);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('only one concurrent request can reserve the last unit from the same snapshot', async () => {
    let stock = 1,
      version = 1;
    const updateMany = jest.fn(async (input: Prisma.ProductUpdateManyArgs) => {
      // Emulates the atomic WHERE evaluation done by PostgreSQL, not a real DB test.
      if (input.where?.version !== version || stock < 1) return { count: 0 };
      stock--;
      version++;
      return { count: 1 };
    });
    const tx = {
      product: { updateMany },
    } as unknown as Prisma.TransactionClient;
    const snapshot = [{ id: 'a', stock: 1, version: 1 }];
    const results = await Promise.allSettled([
      inventory.reserve(tx, [{ productId: 'a', qty: 1 }], snapshot),
      inventory.reserve(tx, [{ productId: 'a', qty: 1 }], snapshot),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(stock).toBe(0);
    expect(version).toBe(2);
  });

  it('uses a consistent product order and combines quantities for restore', async () => {
    const update = jest.fn(async () => ({}));
    const tx = { product: { update } } as unknown as Prisma.TransactionClient;
    await inventory.restore(tx, [
      { productId: 'b', qty: 1 },
      { productId: 'a', qty: 2 },
      { productId: 'b', qty: 3 },
    ]);
    expect(update.mock.calls).toEqual([
      [
        {
          where: { id: 'a' },
          data: { stock: { increment: 2 }, version: { increment: 1 } },
        },
      ],
      [
        {
          where: { id: 'b' },
          data: { stock: { increment: 4 }, version: { increment: 1 } },
        },
      ],
    ]);
  });

  it.each([0, -1, 1.5, NaN, Infinity])(
    'rejects invalid quantity %s before stock mutation',
    async (qty) => {
      await expect(
        inventory.reserve(
          {} as Prisma.TransactionClient,
          [{ productId: 'a', qty }],
          [],
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );
});
