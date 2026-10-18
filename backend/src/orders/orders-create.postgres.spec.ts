import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';
import { cookieOriginGuard } from '../auth/csrf.middleware';
import type { CreateOrderDto } from './dto/create-order.dto';

const databaseUrl = process.env.ORDERS_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const origin = 'http://localhost:3000';

// Opt-in PostgreSQL only. No fallback to the development DATABASE_URL, no reset/truncate.
describeDatabase('Task 06: authenticated order creation on PostgreSQL', () => {
  let app: INestApplication;
  let db: PrismaService;
  let customer: string;
  let otherCustomer: string;
  let cookie: string;
  let otherCookie: string;
  let staffCookie: string;
  const staffId = randomUUID();
  const productIds = [randomUUID(), randomUUID()].sort();
  const toppingId = randomUUID();
  const previousSecret = process.env.JWT_SECRET;
  const previousOrigin = process.env.FRONTEND_ORIGIN;

  const line = (): CreateOrderDto['items'][number] => ({
    productId: productIds[0], size: 'L', toppingIds: [toppingId], quantity: 2,
    ice: '70% đá', sugar: '50% ít ngọt', note: ' Ít ngọt giúp mình ',
  });
  const post = (body: object) => request(app.getHttpServer()).post('/api/orders')
    .set('Cookie', cookie).set('Origin', origin).send(body);

  beforeAll(async () => {
    process.env.JWT_SECRET = 'task06-postgres-test-secret-never-production';
    process.env.FRONTEND_ORIGIN = origin;
    db = new PrismaService({ datasources: { db: { url: databaseUrl! } } });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.use(cookieOriginGuard);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();

    const register = async () => {
      const response = await request(app.getHttpServer()).post('/api/auth/register')
        .set('Origin', origin)
        .send({ name: 'Task 06 Customer', email: `${randomUUID()}@task06.test`, password: `Task06-${randomUUID()}` })
        .expect(201);
      expect(response.body.user.role).toBe('CUSTOMER');
      return { id: response.body.user.id as string, cookie: (response.headers['set-cookie'] as unknown as string[])[0].split(';')[0] };
    };
    const first = await register();
    const second = await register();
    customer = first.id; cookie = first.cookie;
    otherCustomer = second.id; otherCookie = second.cookie;
    await db.user.create({ data: { id: staffId, email: `${staffId}@task06.test`, fullName: 'Task 06 Staff', passwordHash: 'not-a-login', role: 'BARISTA' } });
    staffCookie = `brewlite_session=${module.get(JwtService).sign({ sub: staffId, sessionVersion: 0 })}`;
    await db.topping.create({ data: { id: toppingId, name: 'Task 06 topping' } });
    for (const id of productIds) {
      await db.product.create({ data: {
        id, name: 'Task 06 Coffee', price: 30000, imageUrl: '/test.svg', stock: 6,
        sizes: { create: [
          { code: 'S', name: 'Small', extraPrice: 0 },
          { code: 'M', name: 'Medium', extraPrice: 4000, isDefault: true },
          { code: 'L', name: 'Large', extraPrice: 9000 },
        ] },
        toppings: { create: { toppingId, extraPrice: 6000 } },
      } });
    }
  });

  beforeEach(async () => {
    await db.order.deleteMany({ where: { userId: { in: [customer, otherCustomer] } } });
    await db.cartItem.deleteMany({ where: { cart: { userId: customer } } });
    await db.product.updateMany({ where: { id: { in: productIds } }, data: { stock: 6, version: 1 } });
    await db.productSize.updateMany({ where: { productId: { in: productIds } }, data: { available: true } });
    await db.productTopping.updateMany({ where: { productId: { in: productIds } }, data: { available: true } });
  });

  afterAll(async () => {
    try {
      if (db && customer) {
        await db.order.deleteMany({ where: { userId: { in: [customer, otherCustomer] } } });
        await db.cart.deleteMany({ where: { userId: { in: [customer, otherCustomer] } } });
        await db.product.deleteMany({ where: { id: { in: productIds } } });
        await db.topping.deleteMany({ where: { id: toppingId } });
        await db.user.deleteMany({ where: { id: { in: [customer, otherCustomer, staffId] } } });
      }
    } finally {
      await app?.close();
      if (previousSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = previousSecret;
      if (previousOrigin === undefined) delete process.env.FRONTEND_ORIGIN;
      else process.env.FRONTEND_ORIGIN = previousOrigin;
    }
  });

  async function expectUnchanged() {
    expect(await db.order.count({ where: { userId: customer } })).toBe(0);
    const stock = await db.product.findMany({ where: { id: { in: productIds } }, orderBy: { id: 'asc' } });
    expect(stock.map(({ stock, version }) => ({ stock, version }))).toEqual([{ stock: 6, version: 1 }, { stock: 6, version: 1 }]);
  }

  it('registers through real Auth, persists PENDING/items/history and keeps cart/payment/points unchanged', async () => {
    const cart = await db.cart.upsert({ where: { userId: customer }, create: { userId: customer }, update: {} });
    await db.cartItem.create({ data: {
      cartId: cart.id, ...line(), note: '', configKey: 'task06-cart',
    } });
    const response = await post({ items: [line()] }).expect(201);
    expect(response.body).toMatchObject({ userId: customer, status: 'PENDING', subtotal: 90000, discount: 0, total: 90000 });
    expect(response.body.id).toMatch(/^[a-f0-9-]{36}$/);
    const stored = await db.order.findUniqueOrThrow({ where: { id: response.body.id }, include: { items: { include: { toppings: true } }, statusHistory: true } });
    expect(stored).toMatchObject({ userId: customer, status: 'PENDING', inventoryHeld: true, subtotal: 90000, total: 90000 });
    expect(stored.items).toHaveLength(1);
    expect(stored.items[0]).toMatchObject({ productId: productIds[0], size: 'L', qty: 2, basePrice: 30000, sizePrice: 9000, unitPrice: 45000, lineTotal: 90000, note: 'Ít ngọt giúp mình' });
    expect(stored.items[0].toppings[0]).toMatchObject({ toppingId, name: 'Task 06 topping', extraPrice: 6000 });
    expect(stored.statusHistory).toHaveLength(1);
    expect(stored.statusHistory[0]).toMatchObject({ fromStatus: null, toStatus: 'PENDING', version: 1 });
    expect(await db.product.findUniqueOrThrow({ where: { id: productIds[0] } })).toMatchObject({ stock: 4, version: 2 });
    expect(await db.cartItem.count({ where: { cartId: cart.id } })).toBe(1);
    expect(await db.payment.count({ where: { orderId: stored.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: customer } })).loyaltyPoints).toBe(0);
    await request(app.getHttpServer()).get(`/api/orders/${stored.id}`).set('Cookie', otherCookie).expect(404);
    await request(app.getHttpServer()).get('/api/orders/me').set('Cookie', cookie).expect(200)
      .expect(({ body }) => expect(body.map((order: { id: string }) => order.id)).toEqual([stored.id]));
  });

  it('accepts uppercase UUIDs and persists canonical product/topping identifiers', async () => {
    const response = await post({ items: [{ ...line(), productId: productIds[0].toUpperCase(), toppingIds: [toppingId.toUpperCase()] }] }).expect(201);
    expect(response.body.items[0]).toMatchObject({ productId: productIds[0], toppingIds: [toppingId], unitPrice: 45000 });
  });

  it.each([
    {}, { items: [] },
    { items: [{ quantity: 2 }] },
    ...[0, -1, 1.5, '2'].map((quantity) => ({ items: [{ ...line(), quantity }] })),
  ])('rejects malformed cart %# without database side effects', async (body) => {
    await post(body).expect(400);
    await expectUnchanged();
  });

  it.each(['userId', 'total', 'status', 'discount'])('rejects client-controlled %s before any database mutation', async (key) => {
    await post({ items: [line()], [key]: key === 'status' ? 'PAID' : 1 }).expect(400);
    await expectUnchanged();
  });

  it('rejects unauthenticated, wrong-role and foreign-origin creation', async () => {
    await request(app.getHttpServer()).post('/api/orders').send({ items: [line()] }).expect(401);
    await request(app.getHttpServer()).post('/api/orders').set('Cookie', staffCookie).set('Origin', origin).send({ items: [line()] }).expect(403);
    await request(app.getHttpServer()).post('/api/orders').set('Cookie', cookie).set('Origin', 'https://foreign.example').send({ items: [line()] }).expect(403);
    await expectUnchanged();
  });

  it.each(['product', 'size', 'topping', 'duplicate topping', 'ice', 'sugar'])('rejects invalid %s configuration without reserving stock', async (scenario) => {
    const item = line();
    if (scenario === 'product') item.productId = randomUUID();
    if (scenario === 'size') await db.productSize.updateMany({ where: { productId: productIds[0], code: 'L' }, data: { available: false } });
    if (scenario === 'topping') item.toppingIds = [randomUUID()];
    if (scenario === 'duplicate topping') item.toppingIds = [toppingId, toppingId.toUpperCase()];
    if (scenario === 'ice') item.ice = 'unsupported ice';
    if (scenario === 'sugar') item.sugar = 'unsupported sugar';
    await post({ items: [item] }).expect(400);
    await expectUnchanged();
  });

  it('rolls back an earlier reservation when a later product is out of stock', async () => {
    await db.product.update({ where: { id: productIds[1] }, data: { stock: 0 } });
    await post({ items: [line(), { ...line(), productId: productIds[1] }] }).expect(409);
    expect(await db.order.count({ where: { userId: customer } })).toBe(0);
    expect(await db.product.findUniqueOrThrow({ where: { id: productIds[0] } })).toMatchObject({ stock: 6, version: 1 });
    expect(await db.product.findUniqueOrThrow({ where: { id: productIds[1] } })).toMatchObject({ stock: 0, version: 1 });
  });

  it('aggregates quantities across configurations of the same product', async () => {
    await post({ items: [{ ...line(), quantity: 3 }, { ...line(), size: 'M', quantity: 4 }] }).expect(409);
    await expectUnchanged();
  });

  it('uses the current discount provider while persisting a PENDING order', async () => {
    const response = await post({ items: [line()], promotionCode: 'WELCOME10' }).expect(201);
    expect(response.body).toMatchObject({ status: 'PENDING', subtotal: 90000, discount: 10000, total: 80000 });
    expect(await db.order.findUniqueOrThrow({ where: { id: response.body.id } })).toMatchObject({ discountAmount: 10000, total: 80000 });
  });
});
