import { recipeFixture } from '../../test/fixtures/ingredients';
import { jest } from '@jest/globals';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ProductsService, type ProductListItem } from './products.service';

describe('ProductsService', () => {
  const findMany = jest.fn<() => Promise<ProductListItem[]>>();
  let service: ProductsService;

  beforeEach(() => {
    findMany.mockReset();
    const prisma = { product: { findMany } } as unknown as PrismaService;
    service = new ProductsService(prisma);
  });

  it('queries public catalog fields with stable name/id ordering', async () => {
    const products = [{
      id: '31a650c7-8597-4a01-a8e2-000000000001',
      name: 'Bạc xỉu',
      price: 29000,
      imageUrl: '/images/products/sample-milk-coffee.svg',
      stock: 10,
      description: 'Sample',
    }];
    const recipe = recipeFixture().map((r) => ({
      ...r,
      ingredient: { ...r.ingredient, stock: new Prisma.Decimal(100) },
    }));
    findMany.mockResolvedValue(products.map((p) => ({ ...p, sizes: [{ available: true, recipe }] })));

    await expect(service.findAll()).resolves.toEqual(products);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany).toHaveBeenCalledWith({
      select: { id: true, name: true, price: true, imageUrl: true, stock: true, description: true, sizes: { select: { available: true, recipe: { include: { ingredient: true } } } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  });

  it('returns an empty array when the query has no products', async () => {
    findMany.mockResolvedValue([]);
    await expect(service.findAll()).resolves.toEqual([]);
  });

  it('propagates query failures instead of returning an empty catalog', async () => {
    const error = new Error('Database connection failed');
    findMany.mockRejectedValue(error);
    await expect(service.findAll()).rejects.toBe(error);
  });
});
