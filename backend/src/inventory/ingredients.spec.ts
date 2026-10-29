import { jest } from '@jest/globals';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService, RecipeProduct } from './inventory.service';
import { recipeCapacity } from './recipe-capacity';
import { assertCartAvailability } from './cart-availability';
import type { ProductDetailRecord } from '../products/product-detail';

const amount = (ingredientId: string, value: string) => ({ ingredientId, amount: new Prisma.Decimal(value) });
const product: RecipeProduct = {
  id: 'coffee', sizes: [
    { code: 'M', recipe: [amount('coffee', '20'), amount('milk', '30')] },
    { code: 'L', recipe: [amount('coffee', '25'), amount('milk', '40')] },
  ],
  toppings: [
    { toppingId: 'cream', topping: { recipe: [amount('milk', '15'), amount('cream', '10')] } },
    { toppingId: 'espresso', topping: { recipe: [amount('coffee', '10')] } },
  ],
};
const service = new InventoryService();
const line = { productId: 'coffee', size: 'M', quantity: 2, toppingIds: ['cream', 'espresso'] };

describe('Ingredient demand and calculations', () => {
  it('multiplies every selected topping by cups and combines shared ingredients', () => {
    const rows = service.demand([line], [product]);
    expect(Object.fromEntries(rows.map((r) => [r.ingredientId, r.amount.toString()])))
      .toEqual({ coffee: '60', milk: '90', cream: '20' });
  });

  it('aggregates different sizes, configurations and products sharing an ingredient', () => {
    const rows = service.demand([
      { ...line, quantity: 1, toppingIds: [] },
      { ...line, quantity: 1, size: 'L', toppingIds: ['cream'] },
      { ...line, productId: 'other', quantity: 1, toppingIds: [] },
    ], [product, { ...product, id: 'other' }]);
    expect(Object.fromEntries(rows.map((r) => [r.ingredientId, r.amount.toString()])))
      .toEqual({ coffee: '65', milk: '115', cream: '10' });
  });

  it('retains fractional base units exactly', () => {
    const rows = service.demand([{ ...line, quantity: 3, toppingIds: [] }],
      [{ ...product, sizes: [{ code: 'M', recipe: [amount('salt', '0.125')] }] }]);
    expect(rows[0].amount.toString()).toBe('0.375');
  });

  it.each(['size', 'topping'])('fails closed when the %s recipe is missing', (kind) => {
    const broken = kind === 'size' ? { ...product, sizes: [] } : { ...product, toppings: [] };
    expect(() => service.demand([line], [broken])).toThrow(ConflictException);
  });

  it('calculates cups from the limiting ingredient and rounds down', () => {
    expect(recipeCapacity([
      { amount: new Prisma.Decimal(20), ingredient: { stock: new Prisma.Decimal(99) } },
      { amount: new Prisma.Decimal(30), ingredient: { stock: new Prisma.Decimal(61) } },
    ])).toBe(2);
    expect(recipeCapacity([])).toBe(0);
  });

  it('simulates 1 cup + toppings calculation matching the real user requirements', () => {
    // 1 cup of Size M (20g coffee + 30ml milk) + 1 espresso topping (10g coffee)
    const singleCupWithTopping = { productId: 'coffee', size: 'M', quantity: 1, toppingIds: ['espresso'] };
    const demandSingle = service.demand([singleCupWithTopping], [product]);
    expect(Object.fromEntries(demandSingle.map((r) => [r.ingredientId, r.amount.toString()])))
      .toEqual({ coffee: '30', milk: '30' }); // 20 + 10 = 30g coffee, 30ml milk

    // 3 cups of the same configuration
    const tripleCups = { ...singleCupWithTopping, quantity: 3 };
    const demandTriple = service.demand([tripleCups], [product]);
    expect(Object.fromEntries(demandTriple.map((r) => [r.ingredientId, r.amount.toString()])))
      .toEqual({ coffee: '90', milk: '90' }); // 30 * 3 = 90g coffee, 90ml milk
  });
});

describe('Inventory reservation and release', () => {
  it('reserves ingredients in transaction with optimistic locking', async () => {
    const stockMap: Record<string, { stock: Prisma.Decimal; version: number; name: string }> = {
      coffee: { stock: new Prisma.Decimal(100), version: 1, name: 'Cà phê' },
      milk: { stock: new Prisma.Decimal(200), version: 1, name: 'Sữa tươi' },
    };

    const mockTx = {
      ingredient: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({ id, ...stockMap[id] })),
        updateMany: async ({ where, data }: { where: { id: string; version: number }; data: { stock: { decrement: Prisma.Decimal }; version: { increment: number } } }) => {
          const current = stockMap[where.id];
          if (!current || current.version !== where.version || current.stock.lt(data.stock.decrement)) {
            return { count: 0 };
          }
          current.stock = current.stock.minus(data.stock.decrement);
          current.version += 1;
          return { count: 1 };
        },
      },
    } as unknown as Prisma.TransactionClient;

    const usage = [
      { ingredientId: 'coffee', amount: new Prisma.Decimal(30) },
      { ingredientId: 'milk', amount: new Prisma.Decimal(60) },
    ];

    await service.reserveIngredients(mockTx, usage);

    expect(stockMap.coffee.stock.toString()).toBe('70');
    expect(stockMap.coffee.version).toBe(2);
    expect(stockMap.milk.stock.toString()).toBe('140');
    expect(stockMap.milk.version).toBe(2);
  });

  it('rejects reservation and throws ConflictException with single missing ingredient name when 1 ingredient is insufficient', async () => {
    const stockMap: Record<string, { stock: Prisma.Decimal; version: number; name: string }> = {
      coffee: { stock: new Prisma.Decimal(20), version: 1, name: 'Cà phê' }, // only 20 left, needs 30
      milk: { stock: new Prisma.Decimal(200), version: 1, name: 'Sữa tươi' }, // 200 left, needs 60
    };

    const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
    const mockTx = {
      ingredient: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({ id, ...stockMap[id] })),
        updateMany: updateManyMock,
      },
    } as unknown as Prisma.TransactionClient;

    const usage = [
      { ingredientId: 'coffee', amount: new Prisma.Decimal(30) },
      { ingredientId: 'milk', amount: new Prisma.Decimal(60) },
    ];

    await expect(service.reserveIngredients(mockTx, usage)).rejects.toThrow(ConflictException);
    await expect(service.reserveIngredients(mockTx, usage)).rejects.toThrow(
      'Không đủ nguyên vật liệu: Cà phê. Vui lòng chọn món khác hoặc giảm số lượng!',
    );
    // Verified atomic: no updates attempted when any ingredient is insufficient
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it('rejects reservation and lists all missing ingredient names separated by comma when multiple ingredients are insufficient', async () => {
    const stockMap: Record<string, { stock: Prisma.Decimal; version: number; name: string }> = {
      coffee: { stock: new Prisma.Decimal(20), version: 1, name: 'Cà phê' }, // only 20 left, needs 30
      milk: { stock: new Prisma.Decimal(50), version: 1, name: 'Sữa tươi' }, // only 50 left, needs 60
    };

    const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
    const mockTx = {
      ingredient: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({ id, ...stockMap[id] })),
        updateMany: updateManyMock,
      },
    } as unknown as Prisma.TransactionClient;

    const usage = [
      { ingredientId: 'coffee', amount: new Prisma.Decimal(30) },
      { ingredientId: 'milk', amount: new Prisma.Decimal(60) },
    ];

    await expect(service.reserveIngredients(mockTx, usage)).rejects.toThrow(ConflictException);
    await expect(service.reserveIngredients(mockTx, usage)).rejects.toThrow(
      'Không đủ nguyên vật liệu: Cà phê, Sữa tươi. Vui lòng chọn món khác hoặc giảm số lượng!',
    );
    // Verified atomic: no updates attempted
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it('rejects reservation and lists missing ingredient ID when ingredient is not found in database', async () => {
    const updateManyMock = jest.fn().mockResolvedValue({ count: 1 });
    const mockTx = {
      ingredient: {
        findMany: async () => [], // returns empty, ingredient not found
        updateMany: updateManyMock,
      },
    } as unknown as Prisma.TransactionClient;

    const usage = [
      { ingredientId: 'unknown_ingredient', amount: new Prisma.Decimal(10) },
    ];

    await expect(service.reserveIngredients(mockTx, usage)).rejects.toThrow(ConflictException);
    await expect(service.reserveIngredients(mockTx, usage)).rejects.toThrow(
      'Không đủ nguyên vật liệu: unknown_ingredient. Vui lòng chọn món khác hoặc giảm số lượng!',
    );
    expect(updateManyMock).not.toHaveBeenCalled();
  });

  it('throws ConflictException when optimistic lock version mismatch occurs during updateMany', async () => {
    const stockMap: Record<string, { stock: Prisma.Decimal; version: number; name: string }> = {
      coffee: { stock: new Prisma.Decimal(100), version: 1, name: 'Cà phê' },
    };

    const mockTx = {
      ingredient: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({ id, ...stockMap[id] })),
        updateMany: async () => ({ count: 0 }), // CAS failure, concurrent update happened
      },
    } as unknown as Prisma.TransactionClient;

    const usage = [{ ingredientId: 'coffee', amount: new Prisma.Decimal(30) }];

    await expect(service.reserveIngredients(mockTx, usage)).rejects.toThrow(
      'Kho nguyên liệu vừa thay đổi. Vui lòng thử lại',
    );
  });

  it('restores ingredients back to usable inventory', async () => {
    const stockMap: Record<string, { stock: Prisma.Decimal; version: number }> = {
      coffee: { stock: new Prisma.Decimal(70), version: 2 },
      milk: { stock: new Prisma.Decimal(140), version: 2 },
    };

    const mockTx = {
      ingredient: {
        updateMany: async ({ where, data }: { where: { id: string }; data: { stock: { increment: Prisma.Decimal }; version: { increment: number } } }) => {
          const current = stockMap[where.id];
          current.stock = current.stock.plus(data.stock.increment);
          current.version += 1;
          return { count: 1 };
        },
      },
    } as unknown as Prisma.TransactionClient;

    const usage = [
      { ingredientId: 'coffee', amount: new Prisma.Decimal(30) },
      { ingredientId: 'milk', amount: new Prisma.Decimal(60) },
    ];

    await service.restoreIngredients(mockTx, usage);

    expect(stockMap.coffee.stock.toString()).toBe('100');
    expect(stockMap.coffee.version).toBe(3);
    expect(stockMap.milk.stock.toString()).toBe('200');
    expect(stockMap.milk.version).toBe(3);
  });
});

describe('assertCartAvailability preview', () => {
  const makeProductDetail = (coffeeStock: number, milkStock: number): ProductDetailRecord => {
    return {
      id: 'p-1',
      name: 'Cà phê sữa',
      price: 30000,
      imageUrl: '/img.webp',
      stock: 100,
      version: 1,
      description: '',
      sizes: [
        {
          id: 'size-m',
          productId: 'p-1',
          code: 'M' as const,
          name: 'Size M',
          extraPrice: 0,
          available: true,
          isDefault: true,
          recipe: [
            {
              productSizeId: 'size-m',
              ingredientId: 'coffee',
              amount: new Prisma.Decimal(20),
              ingredient: { id: 'coffee', name: 'Cà phê', unit: 'G' as const, stock: new Prisma.Decimal(coffeeStock), version: 1 },
            },
            {
              productSizeId: 'size-m',
              ingredientId: 'milk',
              amount: new Prisma.Decimal(30),
              ingredient: { id: 'milk', name: 'Sữa tươi', unit: 'ML' as const, stock: new Prisma.Decimal(milkStock), version: 1 },
            },
          ],
        },
      ],
      toppings: [],
    };
  };

  it('passes preview when all ingredients have sufficient stock', () => {
    const product = makeProductDetail(100, 200);
    const items = [{ productId: 'p-1', size: 'M', quantity: 2, toppingIds: [] }];
    expect(() => assertCartAvailability(items, [product])).not.toThrow();
  });

  it('throws ConflictException with single missing ingredient name when 1 ingredient is short', () => {
    const product = makeProductDetail(20, 200); // needs 40g coffee, only 20g available
    const items = [{ productId: 'p-1', size: 'M', quantity: 2, toppingIds: [] }];
    expect(() => assertCartAvailability(items, [product])).toThrow(
      'Không đủ nguyên vật liệu: Cà phê. Vui lòng chọn món khác hoặc giảm số lượng!',
    );
  });

  it('throws ConflictException with all missing ingredient names joined by comma when multiple ingredients are short', () => {
    const product = makeProductDetail(20, 30); // needs 40g coffee (has 20) and 60ml milk (has 30)
    const items = [{ productId: 'p-1', size: 'M', quantity: 2, toppingIds: [] }];
    expect(() => assertCartAvailability(items, [product])).toThrow(
      'Không đủ nguyên vật liệu: Cà phê, Sữa tươi. Vui lòng chọn món khác hoặc giảm số lượng!',
    );
  });
});
