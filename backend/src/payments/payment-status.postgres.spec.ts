import { randomUUID } from 'node:crypto';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../app.module';
import { cookieOriginGuard } from '../auth/csrf.middleware';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma.service';
import { PAYMENT_ORDER_PORT, type PaymentOrderPort } from './payment.types';

// Opt in only with a migrated test DB. Never fall back to the application DB.
const databaseUrl = process.env.ORDERS_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase(
  'Payment status through the real AppModule adapter (PostgreSQL)',
  () => {
    let app: INestApplication;
    let db: PrismaService;
    let orders: OrdersService;
    let port: PaymentOrderPort;
    let ownerCookie: string;
    let otherCookie: string;
    let orderId: string;
    const ownerId = randomUUID();
    const otherId = randomUUID();
    const productId = randomUUID();
    const origin = 'http://localhost:3000';
    const savedEnv = {
      JWT_SECRET: process.env.JWT_SECRET,
      FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
      MOCK_PAYMENT_OUTCOME: process.env.MOCK_PAYMENT_OUTCOME,
    };

    beforeAll(async () => {
      process.env.JWT_SECRET = 'payment-status-postgres-test-only';
      process.env.FRONTEND_ORIGIN = origin;
      db = new PrismaService({ datasources: { db: { url: databaseUrl! } } });
      await db.$connect();
      await db.user.createMany({
        data: [ownerId, otherId].map((id) => ({
          id,
          email: `${id}@payment-status.test`,
          fullName: 'Payment status test',
          passwordHash: 'not-a-login',
          loyaltyPoints: 7,
        })),
      });
      await db.product.create({
        data: {
          id: productId,
          name: 'Payment status fixture',
          price: 25000,
          imageUrl: '/test.svg',
          stock: 2,
          sizes: { create: { code: 'M', name: 'Medium', extraPrice: 0 } },
        },
      });
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(PrismaService)
        .useValue(db)
        .compile();
      orders = module.get(OrdersService);
      port = module.get<PaymentOrderPort>(PAYMENT_ORDER_PORT);
      const jwt = module.get(JwtService);
      ownerCookie = `brewlite_session=${jwt.sign({ sub: ownerId, sessionVersion: 0 })}`;
      otherCookie = `brewlite_session=${jwt.sign({ sub: otherId, sessionVersion: 0 })}`;
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
      await db.payment.deleteMany({
        where: { userId: { in: [ownerId, otherId] } },
      });
      await db.order.deleteMany({ where: { userId: ownerId } });
      await db.user.updateMany({
        where: { id: { in: [ownerId, otherId] } },
        data: { loyaltyPoints: 7 },
      });
      await db.product.update({
        where: { id: productId },
        data: { stock: 2, version: 1 },
      });
      const order = await orders.create(ownerId, {
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
      });
      orderId = order.id;
    });

    afterAll(async () => {
      try {
        if (db) {
          await db.payment.deleteMany({
            where: { userId: { in: [ownerId, otherId] } },
          });
          await db.order.deleteMany({ where: { userId: ownerId } });
          await db.product.deleteMany({ where: { id: productId } });
          await db.user.deleteMany({
            where: { id: { in: [ownerId, otherId] } },
          });
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

    const pay = (cookie = ownerCookie, extra = {}) =>
      request(app.getHttpServer())
        .post('/api/payments')
        .set('Cookie', cookie)
        .set('Origin', origin)
        .send({
          orderId,
          method: 'CARD',
          idempotencyKey: randomUUID(),
          ...extra,
        });
    const storedOrder = () =>
      db.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { statusHistory: { orderBy: { version: 'asc' } } },
      });
    const points = async () =>
      (await db.user.findUniqueOrThrow({ where: { id: ownerId } }))
        .loyaltyPoints;

    it.each(['CARD', 'WALLET'] as const)(
      'PAID maps to PAID and credits existing points policy (%s)',
      async (method) => {
        const response = await pay(ownerCookie, { method }).expect(201);
        expect(response.body).toMatchObject({
          orderId,
          method,
          status: 'PAID',
        });
        const order = await storedOrder();
        expect(order).toMatchObject({
          status: 'PAID',
          inventoryHeld: true,
          version: 2,
        });
        expect(order.statusHistory.map((h) => h.toStatus)).toEqual([
          'PENDING',
          'PAID',
        ]);
        expect(await points()).toBe(9);
        expect(
          (await db.product.findUniqueOrThrow({ where: { id: productId } }))
            .stock,
        ).toBe(1);
        expect(
          await db.payment.findUniqueOrThrow({
            where: { id: response.body.id },
          }),
        ).toMatchObject({ status: 'PAID', amount: 25000 });
      },
    );

    it('PAYMENT_FAILED follows the state machine, releases stock and does not credit points', async () => {
      process.env.MOCK_PAYMENT_OUTCOME = 'PAYMENT_FAILED';
      const response = await pay().expect(201);
      expect(response.body.status).toBe('PAYMENT_FAILED');
      const order = await storedOrder();
      expect(order).toMatchObject({
        status: 'PAYMENT_FAILED',
        inventoryHeld: false,
        version: 2,
      });
      expect(order.statusHistory).toHaveLength(2);
      expect(await points()).toBe(7);
      expect(
        (await db.product.findUniqueOrThrow({ where: { id: productId } }))
          .stock,
      ).toBe(2);
    });

    it.each(['PENDING', 'PAYMENT_FAILED'] as const)(
      'UNKNOWN preserves %s, stock/history and points',
      async (status) => {
        if (status === 'PAYMENT_FAILED')
          await db.$transaction((tx) =>
            orders.transitionInTransaction(tx, orderId, status),
          );
        const before = await storedOrder();
        const stockBefore = await db.product.findUniqueOrThrow({
          where: { id: productId },
        });
        process.env.MOCK_PAYMENT_OUTCOME = 'UNKNOWN';
        if (status === 'PAYMENT_FAILED') {
          // The adapter preserves failed state; a new HTTP attempt now reserves
          // stock and moves back to PENDING before calling any gateway.
          await port.applyPaymentResult({
            orderId,
            userId: ownerId,
            method: 'CARD',
            status: 'UNKNOWN',
          });
        } else {
          expect((await pay().expect(201)).body.status).toBe('UNKNOWN');
        }
        expect(await storedOrder()).toEqual(before);
        expect(
          await db.product.findUniqueOrThrow({ where: { id: productId } }),
        ).toEqual(stockBefore);
        expect(await points()).toBe(7);
      },
    );

    it('rejects another customer before creating a Payment or changing the order', async () => {
      await pay(otherCookie).expect(404);
      expect(await db.payment.count({ where: { orderId } })).toBe(0);
      expect(await storedOrder()).toMatchObject({
        status: 'PENDING',
        version: 1,
      });
      expect(await points()).toBe(7);
    });

    it.each(['PAID', 'PAYMENT_FAILED', 'UNKNOWN'] as const)(
      'the adapter itself checks ownership for %s',
      async (status) => {
        await expect(
          port.applyPaymentResult({
            orderId,
            userId: otherId,
            method: 'CARD',
            status,
          }),
        ).rejects.toMatchObject({ status: 404 });
        expect(await storedOrder()).toMatchObject({
          status: 'PENDING',
          version: 1,
        });
        expect(await points()).toBe(7);
      },
    );

    it.each([
      { status: 'PAID' },
      { status: 'SUCCESS' },
      { userId: otherId },
      { amount: 1 },
    ])(
      'rejects client-controlled payment result/identity/price %j',
      async (extra) => {
        await pay(ownerCookie, extra).expect(400);
        expect(await db.payment.count({ where: { orderId } })).toBe(0);
        expect(await storedOrder()).toMatchObject({
          status: 'PENDING',
          version: 1,
        });
      },
    );

    it('requires authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/payments')
        .set('Origin', origin)
        .send({ orderId, method: 'CARD', idempotencyKey: randomUUID() })
        .expect(401);
      expect(await db.payment.count({ where: { orderId } })).toBe(0);
    });

    it('keeps the real state machine guard when applying PAID to a cancelled order', async () => {
      await orders.staffCancel(orderId, 'Khách yêu cầu hủy');
      await expect(
        port.applyPaymentResult({
          orderId,
          userId: ownerId,
          method: 'CARD',
          status: 'PAID',
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(await storedOrder()).toMatchObject({
        status: 'CANCELLED',
        inventoryHeld: false,
        version: 2,
      });
      expect(await points()).toBe(7);
    });
  },
);
