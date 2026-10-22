import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../src/prisma.service';
import { ProductsModule } from '../src/products/products.module';
import type { ProductListItem } from '../src/products/products.service';
import { productDetailFixture } from './fixtures/product-detail';
// Reuse the detailed HTTP and pricing contract in the acceptance run.
import '../src/products/product-detail.http.spec';
import '../src/cart/cart-pricing.spec';

// Exercises real Nest routing and exception handling with a mocked database.
// This suite does not measure database or production API performance.
describe('Products HTTP contract', () => {
  let app: INestApplication;
  const findMany = jest.fn<() => Promise<ProductListItem[]>>();
  const findUnique = jest.fn<() => Promise<ReturnType<typeof productDetailFixture> | null>>();
  const product = {
    id: '31a650c7-8597-4a01-a8e2-000000000001',
    name: 'Bạc xỉu',
    price: 29000,
    imageUrl: '/images/products/sample-milk-coffee.svg',
    stock: 40,
    description: 'Cà phê và sữa, phục vụ lạnh.',
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ProductsModule] })
      .overrideProvider(PrismaService)
      .useValue({ product: { findMany, findUnique } })
      .compile();

    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.enableCors({ origin: ['http://localhost:3000', 'http://localhost:3001'] });
    await app.init();
  });

  beforeEach(() => {
    findMany.mockReset();
    findUnique.mockReset().mockResolvedValue(null);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns HTTP 200 and the public array without authentication', async () => {
    findMany.mockResolvedValue([product]);

    const response = await request(app.getHttpServer())
      .get('/api/products')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual([product]);
    expect(Object.keys(response.body[0]).sort()).toEqual(['description', 'id', 'imageUrl', 'name', 'price', 'stock']);
    expect(Number.isInteger(response.body[0].price)).toBe(true);
  });

  it('returns HTTP 200 with [] for an empty database result', async () => {
    findMany.mockResolvedValue([]);
    await request(app.getHttpServer()).get('/api/products').expect(200, []);
  });

  it('returns generic HTTP 500 without exposing database connection details', async () => {
    findMany.mockRejectedValue(new Error('postgresql://private-user:private-password@db.internal/catalog'));

    const response = await request(app.getHttpServer()).get('/api/products').expect(500);

    expect(response.body).toEqual({ statusCode: 500, message: 'Internal server error' });
    expect(JSON.stringify(response.body)).not.toContain('private-password');
    expect(JSON.stringify(response.body)).not.toContain('db.internal');
  });

  it('allows the configured local frontend origin to read the response', async () => {
    findMany.mockResolvedValue([product]);
    await request(app.getHttpServer())
      .get('/api/products')
      .set('Origin', 'http://localhost:3001')
      .expect('Access-Control-Allow-Origin', 'http://localhost:3001')
      .expect(200, [product]);
  });

  it('requires the existing /api prefix', async () => {
    await request(app.getHttpServer()).get('/products').expect(404);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown detail without changing the list query', async () => {
    await request(app.getHttpServer()).get(`/api/products/${product.id}`).expect(404);
    expect(findMany).not.toHaveBeenCalled();
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns S/M/L and per-product toppings with prices for detail', async () => {
    const detail = productDetailFixture();
    findUnique.mockResolvedValue(detail);
    const response = await request(app.getHttpServer())
      .get(`/api/products/${detail.id}`).expect(200);
    expect(response.body.sizes.map((size: { code: string }) => size.code)).toEqual(['S', 'M', 'L']);
    expect(response.body.defaultSizeId).toBe(detail.sizes.find((size) => size.isDefault)?.id);
    expect(response.body.toppings).toEqual(detail.toppings.map(({ topping, extraPrice, available }) => ({
      ...topping, extraPrice, available,
    })));
    const selected = response.body.sizes.find((size: { code: string }) => size.code === 'M');
    expect(response.body.price + selected.extraPrice + response.body.toppings[0].extraPrice).toBe(40000);
  });

  it('keeps option configuration separate between products', async () => {
    const first = productDetailFixture();
    const second = productDetailFixture();
    second.id = '31a650c7-8597-4a01-a8e2-000000000002';
    second.price = 45000;
    second.sizes[1].extraPrice = 9000;
    second.toppings = [];
    findUnique.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const a = await request(app.getHttpServer()).get(`/api/products/${first.id}`).expect(200);
    const b = await request(app.getHttpServer()).get(`/api/products/${second.id}`).expect(200);
    expect(a.body.price + a.body.sizes[1].extraPrice).toBe(33000);
    expect(b.body.price + b.body.sizes[1].extraPrice).toBe(54000);
    expect(a.body.toppings).toHaveLength(2);
    expect(b.body.toppings).toEqual([]);
    expect(findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: first.id } }));
    expect(findUnique).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { id: second.id } }));
  });

  it('does not add a product creation endpoint', async () => {
    await request(app.getHttpServer()).post('/api/products').send(product).expect(404);
    expect(findMany).not.toHaveBeenCalled();
  });
});
