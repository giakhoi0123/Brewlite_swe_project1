import { jest } from '@jest/globals';
import { InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { ProductsService } from './products.service';
import { productDetailSelect, type ProductDetailRecord } from './product-detail';
import { productDetailFixture } from '../../test/fixtures/product-detail';

describe('Product detail service', () => {
  const findUnique = jest.fn<() => Promise<ProductDetailRecord | null>>();
  let service: ProductsService;
  beforeEach(() => {
    findUnique.mockReset();
    service = new ProductsService({ product: { findUnique } } as unknown as PrismaService);
  });

  it('queries the requested UUID and projects detail with its own default and availability', async () => {
    const record = productDetailFixture();
    findUnique.mockResolvedValue(record);
    const detail = await service.findOne(record.id);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: record.id }, select: productDetailSelect });
    expect(detail.defaultSizeId).toBe(record.sizes[1].id);
    expect(detail.sizes.map((size) => size.code)).toEqual(['S', 'M', 'L']);
    expect(detail.sizes[2].available).toBe(false);
    expect(detail.toppings[1]).toEqual({ ...record.toppings[1].topping, extraPrice: 6000, available: false });
    expect(detail.sizes[0]).not.toHaveProperty('isDefault');
  });

  it('allows no toppings and an empty description', async () => {
    const record = { ...productDetailFixture(), toppings: [], description: '' };
    findUnique.mockResolvedValue(record);
    await expect(service.findOne(record.id)).resolves.toMatchObject({ toppings: [], description: '' });
  });

  it('returns NotFound only when the product does not exist', async () => {
    findUnique.mockResolvedValue(null);
    await expect(service.findOne(productDetailFixture().id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('propagates a database error for generic Nest exception handling', async () => {
    const failure = new Error('Database connection failed');
    findUnique.mockRejectedValue(failure);
    await expect(service.findOne(productDetailFixture().id)).rejects.toBe(failure);
  });

  it.each(['missing-default', 'duplicate-default', 'unavailable-default', 'missing-size', 'negative-size', 'negative-topping'])('rejects invalid configuration: %s', async (scenario) => {
    const record = productDetailFixture();
    if (scenario === 'missing-default') record.sizes[1].isDefault = false;
    if (scenario === 'duplicate-default') record.sizes[0].isDefault = true;
    if (scenario === 'unavailable-default') record.sizes[1].available = false;
    if (scenario === 'missing-size') record.sizes.pop();
    if (scenario === 'negative-size') record.sizes[0].extraPrice = -1;
    if (scenario === 'negative-topping') record.toppings[0].extraPrice = -1;
    findUnique.mockResolvedValue(record);
    await expect(service.findOne(record.id)).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
