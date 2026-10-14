import { jest } from '@jest/globals';
import type { PrismaClient } from '@prisma/client';
import { sampleProducts } from './seed-products';
import { sampleCustomizations, sampleToppings, seedProductCustomization } from './seed-product-customization';

describe('Product customization development seed', () => {
  it('defines three stable UUID sizes and one available default for each known product', () => {
    const sizeIds = new Set<string>();
    expect(sampleCustomizations).toHaveLength(10);
    for (const config of sampleCustomizations) {
      expect(sampleProducts.some((product) => product.id === config.productId)).toBe(true);
      expect(config.description.trim()).not.toBe('');
      expect(config.sizes.map((size) => size.code)).toEqual(['S', 'M', 'L']);
      expect(config.sizes.filter((size) => size.isDefault && size.available)).toHaveLength(1);
      for (const size of config.sizes) {
        expect(size.productId).toBe(config.productId);
        expect(size.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
        expect(Number.isInteger(size.extraPrice) && size.extraPrice >= 0).toBe(true);
        expect(sizeIds.has(size.id)).toBe(false);
        sizeIds.add(size.id);
      }
      for (const topping of config.toppings) {
        expect(sampleToppings.some((item) => item.id === topping.toppingId)).toBe(true);
        expect(topping.productId).toBe(config.productId);
        expect(Number.isInteger(topping.extraPrice) && topping.extraPrice >= 0).toBe(true);
      }
    }
    expect(sizeIds.size).toBe(30);
    expect(sampleCustomizations[0].sizes[1].id).toBe('c075421a-1160-4e94-84d4-000000000002');
  });

  it('keeps existing size configurations and updates descriptions only when empty', async () => {
    const tx = {
      product: {
        findUnique: jest.fn<() => Promise<{ sizes: { id: string }[] }>>().mockResolvedValue({ sizes: [{ id: 'existing-size' }] }),
        updateMany: jest.fn<() => Promise<{ count: number }>>().mockResolvedValue({ count: 0 }),
      },
      productSize: { createMany: jest.fn() },
      topping: { createMany: jest.fn() },
      productTopping: { createMany: jest.fn() },
    };
    const prisma = { $transaction: async (callback: (client: typeof tx) => Promise<void>) => callback(tx) } as unknown as PrismaClient;
    await seedProductCustomization(prisma);
    expect(tx.productSize.createMany).not.toHaveBeenCalled();
    expect(tx.product.updateMany).toHaveBeenCalledTimes(10);
    expect(tx.product.updateMany).toHaveBeenCalledWith({
      where: { id: sampleCustomizations[0].productId, description: '' },
      data: { description: sampleCustomizations[0].description },
    });
    expect(tx.topping.createMany).toHaveBeenCalledWith({ data: sampleToppings, skipDuplicates: true });
    expect(tx.productTopping.createMany).toHaveBeenCalledWith({ data: sampleCustomizations[0].toppings, skipDuplicates: true });
  });
});
