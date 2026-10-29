import { seedFixtureRecipes } from '../../test/fixtures/ingredients';
import { createHmac, randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module';
import { cookieOriginGuard } from '../auth/csrf.middleware';
import { PrismaService } from '../prisma.service';
import { formEncode } from './vnpay.gateway';

// Opt in with a migrated, dedicated test database. Never use DATABASE_URL here.
const databaseUrl = process.env.PAYMENTS_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('VNPAY Payment and Order PostgreSQL integration', () => {
  let app: INestApplication;
  let module: TestingModule;
  let db: PrismaService;
  const userId = randomUUID();
  const productId = randomUUID();
  const origin = 'http://localhost:3000';
  const tmnCode = 'BREWTEST';
  const hashSecret = 'postgres-vnpay-test-secret';
  const savedEnv = Object.fromEntries(
    [
      'JWT_SECRET',
      'FRONTEND_ORIGIN',
      'FRONTEND_PUBLIC_URL',
      'VNPAY_TMN_CODE',
      'VNPAY_HASH_SECRET',
      'VNPAY_PAYMENT_URL',
      'VNPAY_RETURN_URL',
      'VNPAY_EXPIRE_MINUTES',
    ].map((key) => [key, process.env[key]]),
  );

  beforeAll(async () => {
    process.env.JWT_SECRET = 'payments-postgres-http-test-only';
    process.env.FRONTEND_ORIGIN = origin;
    process.env.FRONTEND_PUBLIC_URL = origin;
    process.env.VNPAY_TMN_CODE = tmnCode;
    process.env.VNPAY_HASH_SECRET = hashSecret;
    process.env.VNPAY_PAYMENT_URL =
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
    process.env.VNPAY_RETURN_URL =
      'http://localhost:3001/api/payments/vnpay/return';
    process.env.VNPAY_EXPIRE_MINUTES = '15';

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
    await seedFixtureRecipes(db, userId, [productId], []);
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
    try {
      if (db) {
        await db.payment.deleteMany({ where: { userId } });
        await db.order.deleteMany({ where: { userId } });
        await db.product.deleteMany({ where: { id: productId } });
        await db.ingredient.deleteMany({ where: { id: userId } });
        await db.user.deleteMany({ where: { id: userId } });
      }
    } finally {
      await app?.close();
      await db?.$disconnect();
      for (const [key, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
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
      .send({ orderId, method: 'VNPAY_QR', idempotencyKey });

  const callback = (
    paymentUrl: string,
    responseCode = '00',
    transactionStatus = '00',
  ) => {
    const url = new URL(paymentUrl);
    const params = {
      vnp_Amount: url.searchParams.get('vnp_Amount')!,
      vnp_BankCode: 'NCB',
      vnp_CardType: 'QRCODE',
      vnp_PayDate: '20261021101500',
      vnp_ResponseCode: responseCode,
      vnp_TmnCode: tmnCode,
      vnp_TransactionNo: '123456789',
      vnp_TransactionStatus: transactionStatus,
      vnp_TxnRef: url.searchParams.get('vnp_TxnRef')!,
    };
    return {
      ...params,
      vnp_SecureHash: createHmac('sha512', hashSecret)
        .update(formEncode(params), 'utf8')
        .digest('hex'),
    };
  };

  it('persists and idempotently replays one PROCESSING URL while blocking another active attempt', async () => {
    const order = await createOrder();
    const idempotencyKey = randomUUID();
    const first = await pay(order.id, idempotencyKey).expect(201);
    expect(first.body).toMatchObject({
      orderId: order.id,
      method: 'VNPAY_QR',
      status: 'PROCESSING',
      idempotencyKey,
      paymentUrl: expect.stringContaining('vnp_SecureHash='),
      expiresAt: expect.any(String),
    });
    await pay(order.id, idempotencyKey).expect(201, first.body);
    await pay(order.id, randomUUID()).expect(409);

    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      await db.payment.findUniqueOrThrow({ where: { id: first.body.id } }),
    ).toMatchObject({
      status: 'PROCESSING',
      amount: order.total,
      paymentUrl: first.body.paymentUrl,
    });
    expect(
      await db.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ status: 'PENDING', inventoryHeld: true });
  });

  it('atomically finalizes success from IPN, ignores replay, and keeps Return read-only', async () => {
    const order = await createOrder();
    const created = await pay(order.id, randomUUID()).expect(201);
    const query = callback(created.body.paymentUrl);

    await request(app.getHttpServer())
      .get('/api/payments/vnpay/ipn')
      .query(query)
      .expect(200, { RspCode: '00', Message: 'Confirm Success' });
    await request(app.getHttpServer())
      .get('/api/payments/vnpay/ipn')
      .query(query)
      .expect(200, {
        RspCode: '02',
        Message: 'Order already confirmed',
      });

    const beforeReturn = {
      payment: await db.payment.findUniqueOrThrow({
        where: { id: created.body.id },
      }),
      order: await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { statusHistory: { orderBy: { version: 'asc' } } },
      }),
      points: (
        await db.user.findUniqueOrThrow({ where: { id: userId } })
      ).loyaltyPoints,
    };
    expect(beforeReturn.payment).toMatchObject({
      status: 'PAID',
      vnpResponseCode: '00',
      vnpTransactionStatus: '00',
      vnpTransactionNo: '123456789',
    });
    expect(beforeReturn.order.status).toBe('PAID');
    expect(beforeReturn.order.statusHistory.map((row) => row.toStatus)).toEqual([
      'PENDING',
      'PAID',
    ]);
    expect(beforeReturn.points).toBe(4);

    await request(app.getHttpServer())
      .get('/api/payments/vnpay/return')
      .query(query)
      .expect(302)
      .expect(
        'Location',
        `${origin}/payment/${order.id}/verifying`,
      );
    expect(
      await db.payment.findUniqueOrThrow({ where: { id: created.body.id } }),
    ).toEqual(beforeReturn.payment);
    expect(
      await db.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { statusHistory: { orderBy: { version: 'asc' } } },
      }),
    ).toEqual(beforeReturn.order);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: userId } }))
        .loyaltyPoints,
    ).toBe(beforeReturn.points);
  });

  it('releases stock on failed IPN and atomically reserves it before a retry URL', async () => {
    await db.ingredient.update({ where: { id: userId }, data: { stock: 50, version: 1 } });
    const order = await createOrder();
    const failed = await pay(order.id, randomUUID()).expect(201);
    await request(app.getHttpServer())
      .get('/api/payments/vnpay/ipn')
      .query(callback(failed.body.paymentUrl, '24', '02'))
      .expect(200, { RspCode: '00', Message: 'Confirm Success' });
    expect(
      await db.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ status: 'PAYMENT_FAILED', inventoryHeld: false });
    expect(
      (await db.ingredient.findUniqueOrThrow({ where: { id: userId } })).stock.toNumber(),
    ).toBe(50);

    await db.ingredient.update({ where: { id: userId }, data: { stock: 0 } });
    await pay(order.id, randomUUID()).expect(409);
    expect(await db.payment.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      await db.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ status: 'PAYMENT_FAILED', inventoryHeld: false });

    await db.ingredient.update({ where: { id: userId }, data: { stock: 50 } });
    const retry = await pay(order.id, randomUUID()).expect(201);
    expect(retry.body.status).toBe('PROCESSING');
    const retriedOrder = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { statusHistory: { orderBy: { version: 'asc' } } },
    });
    expect(retriedOrder).toMatchObject({
      status: 'PENDING',
      inventoryHeld: true,
    });
    expect(retriedOrder.statusHistory.map((row) => row.toStatus)).toEqual([
      'PENDING',
      'PAYMENT_FAILED',
      'PENDING',
    ]);
    expect(
      (await db.ingredient.findUniqueOrThrow({ where: { id: userId } })).stock.toNumber(),
    ).toBe(40);
  });
});
