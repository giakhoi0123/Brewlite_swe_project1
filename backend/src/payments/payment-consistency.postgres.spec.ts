import { randomUUID } from 'node:crypto';
import { jest } from '@jest/globals';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { PaymentResultStatus } from './payment.types';
import { PAYMENT_GATEWAY } from './payment.types';
import request from 'supertest';
import { AppModule } from '../app.module';
import { cookieOriginGuard } from '../auth/csrf.middleware';
import { PrismaService } from '../prisma.service';
import { OrdersService } from '../orders/orders.service';
import { PaymentsService } from './payments.service';
import { PaymentsRepository } from './payments.repository';
import type { CreatePaymentDto } from './dto/create-payment.dto';

const databaseUrl = process.env.ORDERS_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
jest.setTimeout(30000);
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

describeDatabase(
  'Payment consistency on PostgreSQL with two independent AppModules',
  () => {
    let db: PrismaService;
    let secondDb: PrismaService;
    let app: INestApplication;
    let secondApp: INestApplication;
    let service: PaymentsService;
    let secondService: PaymentsService;
    let repo: PaymentsRepository;
    let orders: OrdersService;
    let cookie: string;
    let orderId: string;
    const userId = randomUUID();
    const otherId = randomUUID();
    const productId = randomUUID();
    const origin = 'http://localhost:3000';
    const charge =
      jest.fn<
        (input: {
          orderId: string;
          amount: number;
          method: string;
          idempotencyKey: string;
        }) => Promise<PaymentResultStatus>
      >();
    const saved = {
      JWT_SECRET: process.env.JWT_SECRET,
      FRONTEND_ORIGIN: process.env.FRONTEND_ORIGIN,
    };
    const input = (id = orderId, key = randomUUID()) => ({
      orderId: id,
      method: 'CARD' as const,
      idempotencyKey: key,
    });
    const createOrder = (owner = userId, quantity = 1) =>
      orders.create(owner, {
        items: [
          {
            productId,
            size: 'M',
            toppingIds: [],
            quantity,
            ice: '70% đá',
            sugar: '50% ít ngọt',
          },
        ],
      });
    const payHttp = (payload: CreatePaymentDto = input()) =>
      request(app.getHttpServer())
        .post('/api/payments')
        .set('Cookie', cookie)
        .set('Origin', origin)
        .send(payload);
    const state = () =>
      db.order.findUniqueOrThrow({
        where: { id: orderId },
        include: { statusHistory: { orderBy: { version: 'asc' } } },
      });
    const points = async () =>
      (await db.user.findUniqueOrThrow({ where: { id: userId } }))
        .loyaltyPoints;
    const stock = async () =>
      (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock;

    beforeAll(async () => {
      process.env.JWT_SECRET = 'payment-consistency-test-only';
      process.env.FRONTEND_ORIGIN = origin;
      db = new PrismaService({ datasources: { db: { url: databaseUrl! } } });
      secondDb = new PrismaService({
        datasources: { db: { url: databaseUrl! } },
      });
      await db.$connect();
      await db.user.createMany({
        data: [userId, otherId].map((id) => ({
          id,
          email: `${id}@payment-consistency.test`,
          fullName: 'Consistency test',
          passwordHash: 'not-a-login',
          loyaltyPoints: 7,
        })),
      });
      await db.product.create({
        data: {
          id: productId,
          name: 'Payment consistency fixture',
          price: 25000,
          stock: 2,
          imageUrl: '/test.svg',
          sizes: { create: { code: 'M', name: 'Medium', extraPrice: 0 } },
        },
      });
      const makeModule = (prisma: PrismaService) =>
        Test.createTestingModule({ imports: [AppModule] })
          .overrideProvider(PrismaService)
          .useValue(prisma)
          .overrideProvider(PAYMENT_GATEWAY)
          .useValue({ charge })
          .compile();
      const first = await makeModule(db);
      const second = await makeModule(secondDb);
      service = first.get(PaymentsService);
      secondService = second.get(PaymentsService);
      repo = first.get(PaymentsRepository);
      orders = first.get(OrdersService);
      cookie = `brewlite_session=${first.get(JwtService).sign({ sub: userId, sessionVersion: 0 })}`;
      app = first.createNestApplication({ logger: false });
      app.setGlobalPrefix('api');
      app.use(cookieOriginGuard);
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      secondApp = second.createNestApplication({ logger: false });
      await app.init();
      await secondApp.init();
    });

    const cleanup = async () => {
      await db.payment.deleteMany({
        where: { userId: { in: [userId, otherId] } },
      });
      await db.order.deleteMany({
        where: { userId: { in: [userId, otherId] } },
      });
    };
    beforeEach(async () => {
      jest.restoreAllMocks();
      charge.mockReset().mockResolvedValue('PAID');
      await cleanup();
      await db.user.update({
        where: { id: userId },
        data: { loyaltyPoints: 7 },
      });
      await db.product.update({
        where: { id: productId },
        data: { stock: 2, version: 1, price: 25000 },
      });
      orderId = (await createOrder()).id;
    });
    afterAll(async () => {
      jest.restoreAllMocks();
      try {
        if (db) {
          await cleanup();
          await db.product.deleteMany({ where: { id: productId } });
          await db.user.deleteMany({
            where: { id: { in: [userId, otherId] } },
          });
        }
      } finally {
        await app?.close();
        await secondApp?.close();
        await db?.$disconnect();
        await secondDb?.$disconnect();
        for (const [key, value] of Object.entries(saved)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });

    it('replays PAID through HTTP without charging, points or history twice, even after staff processing', async () => {
      const payload = input();
      const first = (await payHttp(payload).expect(201)).body;
      await orders.staffTransition(orderId, 'PREPARING');
      const before = await state();
      expect((await payHttp(payload).expect(201)).body).toEqual(first);
      expect(await secondService.pay(userId, payload)).toEqual(first);
      expect(await state()).toEqual(before);
      expect(await points()).toBe(9);
      expect(await stock()).toBe(1);
      expect(charge).toHaveBeenCalledTimes(1);
    });

    it.each(['method', 'order'] as const)(
      'rejects the same key with different %s',
      async (field) => {
        const payload = input();
        await payHttp(payload).expect(201);
        const otherOrder = await createOrder();
        const changed =
          field === 'method'
            ? { ...payload, method: 'WALLET' as const }
            : { ...payload, orderId: otherOrder.id };
        await payHttp(changed).expect(409);
        expect(charge).toHaveBeenCalledTimes(1);
        expect(await db.payment.count({ where: { userId } })).toBe(1);
      },
    );

    it.each(['same key', 'different key'] as const)(
      'allows only one external call under concurrent %s across instances',
      async (kind) => {
        const entered = deferred<void>();
        const finish = deferred<PaymentResultStatus>();
        charge.mockImplementationOnce(async () => {
          entered.resolve();
          return finish.promise;
        });
        const payload = input();
        const first = service.pay(userId, payload);
        try {
          await entered.promise;
          await expect(
            secondService.pay(userId, kind === 'same key' ? payload : input()),
          ).rejects.toMatchObject({ status: 409 });
          expect(charge).toHaveBeenCalledTimes(1);
          expect(await db.payment.count({ where: { orderId } })).toBe(1);
        } finally {
          finish.resolve('PAID');
        }
        expect((await first).status).toBe('PAID');
        expect((await secondService.pay(userId, payload)).status).toBe('PAID');
        expect(await points()).toBe(9);
        expect((await state()).statusHistory).toHaveLength(2);
      },
    );

    it('rejects new keys after PAID', async () => {
      await payHttp().expect(201);
      await payHttp().expect(409);
      expect(charge).toHaveBeenCalledTimes(1);
    });

    it('reserves failed-order inventory before calling the gateway for a new key', async () => {
      charge.mockResolvedValueOnce('PAYMENT_FAILED');
      const oldPayload = input();
      const failed = (await payHttp(oldPayload).expect(201)).body;
      expect(await stock()).toBe(2);
      await db.product.update({
        where: { id: productId },
        data: { price: 99000 },
      });
      charge.mockImplementationOnce(async (attempt) => {
        expect(attempt.amount).toBe(25000); // Snapshot, not changed catalog price.
        expect(await stock()).toBe(1);
        expect(await state()).toMatchObject({
          status: 'PENDING',
          inventoryHeld: true,
          version: 3,
        });
        return 'PAID';
      });
      const paid = (await payHttp().expect(201)).body;
      expect(paid.status).toBe('PAID');
      expect((await state()).statusHistory.map((h) => h.toStatus)).toEqual([
        'PENDING',
        'PAYMENT_FAILED',
        'PENDING',
        'PAID',
      ]);
      expect(await points()).toBe(9);
      expect((await payHttp(oldPayload).expect(201)).body).toEqual(failed);
      expect((await state()).status).toBe('PAID');
      expect(charge).toHaveBeenCalledTimes(2);
    });

    it('rolls retry back with 409 when another order has consumed the released stock', async () => {
      charge.mockResolvedValueOnce('PAYMENT_FAILED');
      await payHttp().expect(201);
      await createOrder(otherId, 2);
      const before = await state();
      await payHttp().expect(409);
      expect(await state()).toEqual(before);
      expect(await stock()).toBe(0);
      expect(charge).toHaveBeenCalledTimes(1);
      expect(await db.payment.count({ where: { orderId } })).toBe(1);
    });

    it('rolls retry reservation/history back if the claim key conflicts with another order', async () => {
      charge.mockResolvedValueOnce('PAYMENT_FAILED');
      await payHttp().expect(201);
      const otherOrder = await createOrder();
      const used = input(otherOrder.id);
      await payHttp(used).expect(201);
      const before = await state();
      await payHttp({ ...used, orderId }).expect(409);
      expect(await state()).toEqual(before);
      expect(await stock()).toBe(1);
      expect(charge).toHaveBeenCalledTimes(2);
    });

    it('rolls retry stock/history and the new Payment back if claim persistence fails', async () => {
      charge.mockResolvedValueOnce('PAYMENT_FAILED');
      await payHttp().expect(201);
      const before = await state();
      const original = repo.claim.bind(repo);
      jest.spyOn(repo, 'claim').mockImplementationOnce(async (attempt, tx) => {
        await original(attempt, tx);
        throw new Error('injected claim write failure');
      });
      await payHttp().expect(500);
      expect(await state()).toEqual(before);
      expect(await stock()).toBe(2);
      expect(charge).toHaveBeenCalledTimes(1);
      expect(await db.payment.count({ where: { orderId } })).toBe(1);
    });

    it.each(['UNKNOWN', 'timeout'] as const)(
      'replays %s without promoting to PAID and blocks new keys',
      async (outcome) => {
        if (outcome === 'timeout')
          charge.mockRejectedValueOnce(new Error('uncertain gateway result'));
        else charge.mockResolvedValueOnce('UNKNOWN');
        const payload = input();
        const first = (await payHttp(payload).expect(201)).body;
        expect(first.status).toBe('UNKNOWN');
        expect((await payHttp(payload).expect(201)).body).toEqual(first);
        await payHttp().expect(409);
        await expect(secondService.pay(userId, input())).rejects.toMatchObject({
          status: 409,
        });
        expect(charge).toHaveBeenCalledTimes(1);
        expect(await state()).toMatchObject({
          status: 'PENDING',
          inventoryHeld: true,
          version: 1,
        });
        expect(await points()).toBe(7);
        expect(await stock()).toBe(1);
      },
    );

    it('UNKNOWN during retry keeps the newly reserved order PENDING and blocks further attempts', async () => {
      charge
        .mockResolvedValueOnce('PAYMENT_FAILED')
        .mockResolvedValueOnce('UNKNOWN');
      await payHttp().expect(201);
      const payload = input();
      expect((await payHttp(payload).expect(201)).body.status).toBe('UNKNOWN');
      await payHttp().expect(409);
      expect((await state()).statusHistory.map((h) => h.toStatus)).toEqual([
        'PENDING',
        'PAYMENT_FAILED',
        'PENDING',
      ]);
      expect(await stock()).toBe(1);
      expect(await points()).toBe(7);
      expect(charge).toHaveBeenCalledTimes(2);
    });

    it.each(['PAID', 'PAYMENT_FAILED'] as const)(
      'rolls finalization back after writes then recovers journaled %s from another instance',
      async (outcome) => {
        charge.mockResolvedValueOnce(outcome);
        const original = repo.finalize.bind(repo);
        jest
          .spyOn(repo, 'finalize')
          .mockImplementationOnce(async (id, status, tx) => {
            await original(id, status, tx);
            throw new Error(
              'injected crash after Payment, Order and point writes',
            );
          });
        const payload = input();
        await payHttp(payload).expect(500);
        const pending = await db.payment.findFirstOrThrow({
          where: { orderId },
        });
        expect(pending).toMatchObject({
          status: 'PROCESSING',
          gatewayStatus: outcome,
          appliedAt: null,
        });
        expect(await state()).toMatchObject({
          status: 'PENDING',
          inventoryHeld: true,
          version: 1,
        });
        expect((await state()).statusHistory).toHaveLength(1);
        expect(await points()).toBe(7);
        expect(await stock()).toBe(1);
        await expect(secondService.pay(userId, input())).rejects.toMatchObject({
          status: 409,
        });
        const recovered = await secondService.pay(userId, payload);
        expect(recovered.status).toBe(outcome);
        expect(await service.pay(userId, payload)).toEqual(recovered);
        expect(charge).toHaveBeenCalledTimes(1);
        expect(await points()).toBe(outcome === 'PAID' ? 9 : 7);
        expect(await stock()).toBe(outcome === 'PAID' ? 1 : 2);
        expect((await state()).statusHistory).toHaveLength(2);
        expect(
          (await db.payment.findUniqueOrThrow({ where: { id: pending.id } }))
            .appliedAt,
        ).not.toBeNull();
      },
    );

    it('does not charge again if persisting the gateway journal fails', async () => {
      jest
        .spyOn(repo, 'recordGatewayResult')
        .mockRejectedValueOnce(new Error('journal write unavailable'));
      const payload = input();
      await payHttp(payload).expect(500);
      expect(
        await db.payment.findFirstOrThrow({ where: { orderId } }),
      ).toMatchObject({ status: 'PROCESSING', gatewayStatus: null });
      await payHttp(payload).expect(409);
      await expect(secondService.pay(userId, input())).rejects.toMatchObject({
        status: 409,
      });
      expect(charge).toHaveBeenCalledTimes(1);
      expect(await points()).toBe(7);
      expect((await state()).status).toBe('PENDING');
    });

    it('does not auto-expire an orphan PROCESSING claim or call the gateway on replay', async () => {
      const payload = input();
      await db.payment.create({
        data: {
          ...payload,
          userId,
          amount: 25000,
          createdAt: new Date('2000-01-01'),
        },
      });
      await payHttp(payload).expect(409);
      await payHttp().expect(409);
      expect(charge).not.toHaveBeenCalled();
    });

    it('does not hold the Order row lock across the external gateway call', async () => {
      charge.mockImplementationOnce(async () => {
        await secondDb.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '500ms'");
          await tx.$queryRaw`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
        });
        return 'PAID';
      });
      expect((await payHttp().expect(201)).body.status).toBe('PAID');
    });

    it('enforces the live-attempt uniqueness constraint independently of application locks', async () => {
      await db.payment.create({ data: { ...input(), userId, amount: 25000 } });
      await expect(
        db.payment.create({ data: { ...input(), userId, amount: 25000 } }),
      ).rejects.toMatchObject({ code: 'P2002' });
      expect(await db.payment.count({ where: { orderId } })).toBe(1);
    });

    it('handles two different orders concurrently reusing one user key without a second charge', async () => {
      const otherOrder = await createOrder();
      const key = randomUUID();
      const results = await Promise.allSettled([
        service.pay(userId, input(orderId, key)),
        secondService.pay(userId, input(otherOrder.id, key)),
      ]);
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.find((r) => r.status === 'rejected');
      expect(rejected).toMatchObject({
        status: 'rejected',
        reason: { status: 409 },
      });
      expect(charge).toHaveBeenCalledTimes(1);
      expect(await points()).toBe(9);
    });
  },
);
