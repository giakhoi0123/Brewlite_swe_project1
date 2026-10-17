import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module';
import { cookieOriginGuard } from '../auth/csrf.middleware';
import { PrismaService } from '../prisma.service';

// Opt in with a migrated, dedicated test database. Never fall back to DATABASE_URL.
const databaseUrl = process.env.PAYMENTS_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('Payments and Orders PostgreSQL integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: PrismaService;
  const userId = randomUUID();
  const productId = randomUUID();
  const origin = 'http://localhost:3000';

  beforeAll(async () => {
    process.env.JWT_SECRET = 'payments-postgres-http-test-only';
    process.env.FRONTEND_ORIGIN = origin;
    db = new PrismaService({ datasources: { db: { url: databaseUrl! } } });
    await db.$connect();
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@payments.test`,
        fullName: 'Payments test',
        passwordHash: 'not-a-login',
      },
    });
    await db.product.create({
      data: {
        id: productId,
        name: 'Payment test coffee',
        price: 40000,
        imageUrl: '/test.svg',
        stock: 5,
        sizes: {
          create: {
            code: 'M',
            name: 'Medium',
            extraPrice: 0,
            isDefault: true,
          },
        },
      },
    });
    module = await Test.createTestingModule({ imports: [AppModule] })
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
    await app.init();
  });

  beforeEach(async () => {
    process.env.MOCK_PAYMENT_OUTCOME = 'PAID';
    await db.payment.deleteMany({ where: { userId } });
    await db.order.deleteMany({ where: { userId } });
    await db.product.update({
      where: { id: productId },
      data: { stock: 5, version: 1 },
    });
    await db.user.update({
      where: { id: userId },
      data: { loyaltyPoints: 0 },
    });
  });

  afterAll(async () => {
    delete process.env.MOCK_PAYMENT_OUTCOME;
    if (app) await app.close();
    if (!db) return;
    await db.payment.deleteMany({ where: { userId } });
    await db.order.deleteMany({ where: { userId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  const cookie = () =>
    `brewlite_session=${module
      .get(JwtService)
      .sign({ sub: userId, sessionVersion: 0 })}`;

  const createOrder = async () => {
    const response = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Cookie', cookie())
      .set('Origin', origin)
      .send({
        items: [
          {
            productId,
            size: 'M',
            toppingIds: [],
            quantity: 1,
            ice: '70% đá',
            sugar: '50% ít ngọt',
          },
        ],
      })
      .expect(201);
    return response.body as { id: string; total: number };
  };

  const pay = (orderId: string, idempotencyKey: string) =>
    request(app.getHttpServer())
      .post('/api/payments')
      .set('Cookie', cookie())
      .set('Origin', origin)
      .send({ orderId, method: 'CARD', idempotencyKey });

  it('persists one payment, marks the order PAID and replays without duplicate data', async () => {
    const order = await createOrder();
    const idempotencyKey = randomUUID();
    const first = await pay(order.id, idempotencyKey).expect(201);
    expect(first.body).toMatchObject({
      orderId: order.id,
      method: 'CARD',
      status: 'PAID',
      idempotencyKey,
    });

    const persistedPayment = await db.payment.findFirstOrThrow({
      where: { userId, orderId: order.id },
    });
    const persistedOrder = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { statusHistory: { orderBy: { version: 'asc' } } },
    });
    const persistedUser = await db.user.findUniqueOrThrow({
      where: { id: userId },
    });
    expect(persistedPayment).toMatchObject({
      amount: order.total,
      status: 'PAID',
      idempotencyKey,
    });
    expect(persistedOrder.status).toBe('PAID');
    expect(persistedOrder.statusHistory.map((row) => row.toStatus)).toEqual([
      'PENDING',
      'PAID',
    ]);
    expect(persistedUser.loyaltyPoints).toBe(4);

    const paidOrder = await request(app.getHttpServer())
      .get(`/api/orders/${order.id}`)
      .set('Cookie', cookie())
      .expect(200);
    expect(paidOrder.body).toMatchObject({
      id: order.id,
      status: 'PAID',
      paymentMethod: 'CARD',
    });

    await pay(order.id, idempotencyKey).expect(201, first.body);
    expect(
      await db.payment.count({ where: { userId, orderId: order.id } }),
    ).toBe(1);
    expect(
      await db.orderStatusHistory.count({ where: { orderId: order.id } }),
    ).toBe(2);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: userId } }))
        .loyaltyPoints,
    ).toBe(4);
  });

  it('persists failure, restores stock, then reserves it again for a paid retry', async () => {
    const order = await createOrder();
    process.env.MOCK_PAYMENT_OUTCOME = 'PAYMENT_FAILED';
    await pay(order.id, randomUUID()).expect(201);
    expect(
      await db.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ status: 'PAYMENT_FAILED', inventoryHeld: false });
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock,
    ).toBe(5);

    process.env.MOCK_PAYMENT_OUTCOME = 'PAID';
    await pay(order.id, randomUUID()).expect(201);
    const retriedOrder = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { statusHistory: { orderBy: { version: 'asc' } } },
    });
    expect(retriedOrder).toMatchObject({ status: 'PAID', inventoryHeld: true });
    expect(retriedOrder.statusHistory.map((row) => row.toStatus)).toEqual([
      'PENDING',
      'PAYMENT_FAILED',
      'PENDING',
      'PAID',
    ]);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock,
    ).toBe(4);
    expect(
      await db.payment.findMany({
        where: { userId, orderId: order.id },
        orderBy: { createdAt: 'asc' },
        select: { status: true },
      }),
    ).toEqual([{ status: 'PAYMENT_FAILED' }, { status: 'PAID' }]);
  });

  it('enforces the payment order foreign key', async () => {
    await expect(
      db.payment.create({
        data: {
          userId,
          orderId: randomUUID(),
          amount: 40000,
          method: 'CARD',
          status: 'PAID',
          idempotencyKey: randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });
});
