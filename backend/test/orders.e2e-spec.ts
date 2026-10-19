import { jest } from '@jest/globals';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Role, UserStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { cookieOriginGuard } from '../src/auth/csrf.middleware';
// Database-backed races/rollback and cart HTTP behaviour are opt-in acceptance cases.
import '../src/cart/cart.http.spec';
import '../src/orders/orders.postgres.spec';
import '../src/orders/orders-create.postgres.spec';

describe('Orders HTTP (real guards, DTOs and service; database test double)', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const customer = '10000000-0000-4000-8000-000000000001';
  const staff = '10000000-0000-4000-8000-000000000002';
  const productId = '2a000000-0000-4000-8000-000000000001';
  const toppingId = '2b000000-0000-4000-8000-000000000001';
  const orderId = '30000000-0000-4000-8000-000000000001';
  const findFirst = jest.fn(async (_args: unknown): Promise<any> => null);
  const updateMany = jest.fn(async (_args: unknown) => ({ count: 1 }));
  const create = jest.fn(async ({ data }: { data: any }) => ({
    id: orderId,
    ...data,
    createdAt: new Date('2026-10-15T00:00:00Z'),
    items: data.items.create.map((i: any) => ({
      ...i,
      id: 'item',
      toppings: i.toppings.create,
    })),
  }));
  const findMany = jest.fn(async (_args: unknown) => []);
  const db = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        [customer, staff].includes(where.id)
          ? {
              id: where.id,
              status: UserStatus.ACTIVE,
              role: where.id === staff ? Role.BARISTA : Role.CUSTOMER,
              sessionVersion: 0,
            }
          : null,
    },
    product: {
      findMany: async () => [
        {
          id: productId,
          name: 'Coffee',
          imageUrl: '/coffee.svg',
          price: 29000,
          stock: 5,
          version: 1,
          sizes: [{ code: 'M', extraPrice: 5000, available: true }],
          toppings: [{ toppingId, extraPrice: 6000, available: true, topping: { name: 'Kem sữa' } }],
        },
      ],
      updateMany,
    },
    order: { create, findFirst, findMany },
    $connect: async () => {},
    $disconnect: async () => {},
    $transaction: async (
      work: (tx: unknown) => Promise<unknown>,
    ): Promise<unknown> => work(db),
  };
  const payload = {
    items: [
      {
        productId,
        size: 'M',
        toppingIds: [],
        quantity: 2,
        ice: '70% đá',
        sugar: '50% ít ngọt',
      },
    ],
  };
  const cookie = (id = customer) =>
    `brewlite_session=${jwt.sign({ sub: id, sessionVersion: 0 })}`;
  const post = (body: object) =>
    request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', cookie())
      .set('Origin', 'http://localhost:3000')
      .send(body);

  beforeAll(async () => {
    process.env.JWT_SECRET = 'orders-http-test-secret';
    process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.use(cookieOriginGuard);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    jwt = module.get(JwtService);
    await app.init();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue(null);
  });
  afterAll(async () => {
    await app?.close();
  });

  it('POST returns a server-priced PENDING order using the authenticated owner', async () => {
    const response = await post(payload).expect(201);
    expect(response.body).toMatchObject({
      id: orderId,
      userId: customer,
      status: 'PENDING',
      subtotal: 68000,
      total: 68000,
      discount: 0,
    });
    expect(response.body.items[0]).toMatchObject({
      quantity: 2,
      unitPrice: 34000,
      toppingIds: [],
    });
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it('normalizes uppercase product and topping UUIDs before catalog lookup', async () => {
    const response = await post({
      items: [{ ...payload.items[0], productId: productId.toUpperCase(), toppingIds: [toppingId.toUpperCase()] }],
    }).expect(201);
    expect(response.body).toMatchObject({ status: 'PENDING', userId: customer, total: 80000 });
    expect(response.body.items[0]).toMatchObject({ productId, toppingIds: [toppingId], unitPrice: 40000 });
  });

  it.each([
    {},
    { items: [] },
    { items: null },
    { items: [null] },
    { ...payload, userId: staff },
    { ...payload, total: 1 },
    { ...payload, status: 'PAID' },
    { ...payload, discount: 99999 },
    { items: Array.from({ length: 101 }, () => payload.items[0]) },
    ...[0, -1, 1.5, '2', 100].map((quantity) => ({
      items: [{ ...payload.items[0], quantity }],
    })),
    ...[
      { unitPrice: 1 },
      { productId: 'invalid' },
      { size: 'XL' },
      { toppingIds: ['bad'] },
      { note: 'x'.repeat(121) },
      { toppingIds: [productId, productId] },
      { toppingIds: [toppingId, toppingId.toUpperCase()] },
      { toppingIds: 'not-an-array' },
      { ice: '' },
      { ice: 'unsupported ice' },
      { sugar: 'unsupported sugar' },
      { sugar: null },
      { lineTotal: 1 },
    ].map((override) => ({ items: [{ ...payload.items[0], ...override }] })),
  ])('rejects malformed/tampered cart %# before mutation', async (body) => {
    await post(body).expect(400);
    expect(create).not.toHaveBeenCalled();
    expect(updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 on stale inventory and does not create an order', async () => {
    updateMany.mockResolvedValue({ count: 0 });
    await post(payload).expect(409);
    expect(create).not.toHaveBeenCalled();
  });

  it('enforces authentication, role and cookie Origin for writes', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .send(payload)
      .expect(401);
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', cookie(staff))
      .set('Origin', 'http://localhost:3000')
      .send(payload)
      .expect(403);
    for (const origin of ['', 'https://foreign.example']) {
      await request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', cookie())
        .set('Origin', origin)
        .send(payload)
        .expect(403);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it('protects reads and scopes detail/status queries to the current owner', async () => {
    for (const path of [
      '/orders/me',
      `/orders/${orderId}`,
      `/orders/${orderId}/status`,
      '/staff/orders',
    ]) {
      await request(app.getHttpServer()).get(`/api${path}`).expect(401);
    }
    await request(app.getHttpServer())
      .get('/api/orders/me')
      .set('Cookie', cookie())
      .expect(200, []);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: customer } }),
    );
    for (const suffix of ['', '/status']) {
      await request(app.getHttpServer())
        .get(`/api/orders/${orderId}${suffix}`)
        .set('Cookie', cookie())
        .expect(404);
      expect(findFirst).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: { id: orderId, userId: customer } }),
      );
    }
    await request(app.getHttpServer())
      .get('/api/orders/not-a-uuid')
      .set('Cookie', cookie())
      .expect(400);
  });

  it('restricts staff endpoints and never exposes payment transitions to Barista', async () => {
    await request(app.getHttpServer())
      .get('/api/staff/orders')
      .set('Cookie', cookie())
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/staff/orders')
      .set('Cookie', cookie(staff))
      .expect(200, []);
    await request(app.getHttpServer())
      .patch(`/api/staff/orders/${orderId}/status`)
      .set('Cookie', cookie())
      .set('Origin', 'http://localhost:3000')
      .send({ status: 'CANCELLED' })
      .expect(403);
    for (const status of ['PAID', 'PENDING', 'PAYMENT_FAILED', 'UNKNOWN']) {
      await request(app.getHttpServer())
        .patch(`/api/staff/orders/${orderId}/status`)
        .set('Cookie', cookie(staff))
        .set('Origin', 'http://localhost:3000')
        .send({ status })
        .expect(400);
    }
  });

  it('requires a nonblank reason and BARISTA role to cancel', async () => {
    await request(app.getHttpServer()).patch(`/api/staff/orders/${orderId}/cancel`)
      .set('Origin', 'http://localhost:3000').send({ reason: 'Máy pha hỏng' }).expect(401);
    await request(app.getHttpServer()).patch(`/api/staff/orders/${orderId}/cancel`)
      .set('Cookie', cookie()).set('Origin', 'http://localhost:3000')
      .send({ reason: 'Máy pha hỏng' }).expect(403);
    await request(app.getHttpServer()).patch(`/api/staff/orders/${orderId}/cancel`)
      .set('Cookie', cookie(staff)).set('Origin', 'http://localhost:3000')
      .send({ reason: '   ' }).expect(400);
  });

  it('returns a JSON object for status so the browser can parse it', async () => {
    findFirst.mockResolvedValue({
      id: orderId,
      userId: customer,
      status: 'PENDING',
      subtotal: 68000,
      discountAmount: 0,
      total: 68000,
      createdAt: new Date(),
      items: [],
    });
    await request(app.getHttpServer())
      .get(`/api/orders/${orderId}/status`)
      .set('Cookie', cookie())
      .expect('Content-Type', /json/)
      .expect(200, { status: 'PENDING' });
  });
});
