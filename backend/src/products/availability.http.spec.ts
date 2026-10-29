import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import request from 'supertest';
import { ProductsModule } from './products.module';
import { PrismaService } from '../prisma.service';
import { productDetailFixture } from '../../test/fixtures/product-detail';

describe('whole-cart availability HTTP (Prisma stub)', () => {
  let app: INestApplication;
  let product = productDetailFixture();
  const body = (quantity = 1) => ({ items: [{ productId: product.id, size: 'S', quantity,
    toppingIds: [], ice: '100% đá', sugar: '100% chuẩn' }] });
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [ProductsModule] })
      .overrideProvider(PrismaService).useValue({
        product: { findMany: async () => [product] },
        ingredient: { findMany: async () => product.sizes.flatMap((s) => s.recipe.map((r) => r.ingredient)) },
      }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });
  beforeEach(() => {
    product = productDetailFixture();
    for (const s of product.sizes) s.recipe[0].ingredient.stock = new Prisma.Decimal(360);
  });
  afterAll(async () => { await app?.close(); });
  it('validates a guest cart without storing or reserving it', async () => {
    const response = await request(app.getHttpServer()).post('/products/availability').send(body(36)).expect(200);
    expect(response.body).toEqual({ valid: true });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(product.sizes[0].recipe[0].ingredient.stock.toNumber()).toBe(360);
  });
  it('rejects a complete cart which is short although individual lines fit', async () => {
    const first = body(20).items[0];
    const response = await request(app.getHttpServer()).post('/products/availability')
      .send({ items: [first, { ...first, quantity: 17 }] }).expect(409);
    expect(response.body.message).toContain('Không đủ nguyên vật liệu');
  });
  it('validates empty cart, quantities, UUIDs and duplicate toppings', async () => {
    await request(app.getHttpServer()).post('/products/availability').send({ items: [] }).expect(200);
    await request(app.getHttpServer()).post('/products/availability').send(body(100)).expect(400);
    await request(app.getHttpServer()).post('/products/availability').send({ items: [{ ...body().items[0], productId: 'bad' }] }).expect(400);
    const id = product.toppings[0].topping.id;
    await request(app.getHttpServer()).post('/products/availability').send({ items: [{ ...body().items[0], toppingIds: [id, id] }] }).expect(400);
  });

  it('POST /products/preview returns candidate availability and next-cup shortages', async () => {
    // 360 stock / 10 amount = 36 max
    const candidate = { productId: product.id, size: 'S', quantity: 36, toppingIds: [], ice: '100% đá', sugar: '100% chuẩn' };
    const res = await request(app.getHttpServer()).post('/products/preview')
      .send({ candidate, cartItems: [] })
      .expect(200);
    expect(res.body.valid).toBe(true);
    expect(res.body.canAddOne).toBe(false);
    expect(res.body.maxAvailable).toBe(36);
    expect(res.body.nextShortages).toHaveLength(1);
    expect(res.body.nextShortages[0].shortage).toBe(10);
  });
});
