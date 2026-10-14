import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma.service';
import { ProductsModule } from './products.module';
import type { ProductDetailRecord } from './product-detail';
import { productDetailFixture } from '../../test/fixtures/product-detail';

// Real HTTP controller/UUID pipe/service/errors; only Prisma is mocked.
describe('Product detail HTTP', () => {
  let app: INestApplication;
  const findUnique = jest.fn<() => Promise<ProductDetailRecord | null>>();
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ProductsModule] })
      .overrideProvider(PrismaService).useValue({ product: { findUnique } }).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.init();
  });
  beforeEach(() => findUnique.mockReset());
  afterAll(async () => { await app?.close(); });

  it('returns the direct contract without auth, with integer extras and an owned default', async () => {
    const record = productDetailFixture();
    findUnique.mockResolvedValue(record);
    const response = await request(app.getHttpServer()).get(`/api/products/${record.id}`).expect(200).expect('Content-Type', /json/);
    expect(Object.keys(response.body).sort()).toEqual(['defaultSizeId', 'description', 'id', 'imageUrl', 'name', 'price', 'sizes', 'toppings']);
    expect(response.body.price).toBe(29000);
    expect(response.body.sizes).toHaveLength(3);
    expect(response.body.defaultSizeId).toBe(record.sizes[1].id);
    expect(response.body.sizes.some((size: { id: string; available: boolean }) => size.id === response.body.defaultSizeId && size.available)).toBe(true);
    for (const size of response.body.sizes) {
      expect(Object.keys(size).sort()).toEqual(['available', 'code', 'extraPrice', 'id', 'name']);
      expect(Number.isInteger(size.extraPrice) && size.extraPrice >= 0).toBe(true);
    }
    expect(response.body.toppings).toEqual(record.toppings.map(({ topping, ...option }) => ({ ...topping, ...option })));
    expect(response.body).not.toHaveProperty('stock');
  });

  it.each(['not-a-uuid', '123', '31a650c7-8597-4a01-a8e2-00000000000z'])('rejects malformed id before querying: %s', async (id) => {
    await request(app.getHttpServer()).get(`/api/products/${id}`).expect(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('accepts UUIDs written in uppercase', async () => {
    const record = productDetailFixture();
    findUnique.mockResolvedValue(record);
    const response = await request(app.getHttpServer()).get(`/api/products/${record.id.toUpperCase()}`).expect(200);
    expect(response.body.id).toBe(record.id);
  });

  it('returns 404 for a valid UUID with no product', async () => {
    findUnique.mockResolvedValue(null);
    const response = await request(app.getHttpServer()).get('/api/products/31a650c7-8597-4a01-a8e2-000000000999').expect(404);
    expect(response.body.message).toBe('Product not found');
  });

  it('returns generic 500 for query failures without a trace or connection details', async () => {
    findUnique.mockRejectedValue(new Error('postgresql://private-user:private-password@db.internal/catalog'));
    const response = await request(app.getHttpServer()).get(`/api/products/${productDetailFixture().id}`).expect(500);
    expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toMatch(/private-password|db\.internal/);
  });

  it('returns 500 for existing products without options instead of a fake detail or 404', async () => {
    findUnique.mockResolvedValue({ ...productDetailFixture(), sizes: [] });
    const response = await request(app.getHttpServer()).get(`/api/products/${productDetailFixture().id}`).expect(500);
    expect(response.body).toEqual({ statusCode: 500, message: 'Internal Server Error' });
  });
});
