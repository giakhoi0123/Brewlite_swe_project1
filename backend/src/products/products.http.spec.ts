import { jest } from '@jest/globals';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PrismaService } from '../prisma.service';
import { ProductsModule } from './products.module';
import type { ProductListItem } from './products.service';

// Exercises real Nest routing and exception handling with a mocked database.
// This suite does not measure database or production API performance.
describe('Products HTTP contract', () => {
  let app: INestApplication;
  const findMany = jest.fn<() => Promise<ProductListItem[]>>();
  const findUnique = jest.fn<() => Promise<null>>();
  const product = {
    id: '31a650c7-8597-4a01-a8e2-000000000001',
    name: 'Bạc xỉu',
    price: 29000,
    imageUrl: '/images/products/sample-milk-coffee.svg',
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
    expect(Object.keys(response.body[0]).sort()).toEqual(['id', 'imageUrl', 'name', 'price']);
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

  it('does not add a product creation endpoint', async () => {
    await request(app.getHttpServer()).post('/api/products').send(product).expect(404);
    expect(findMany).not.toHaveBeenCalled();
  });
});
