import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { OrderStatus } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../app.module';
import { cookieOriginGuard } from '../auth/csrf.middleware';
import { PrismaService } from '../prisma.service';
import { OrdersService } from './orders.service';

// Opt-in only. The verifier provisions and drops a dedicated UUID-named database.
const databaseUrl = process.env.ORDERS_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('Staff Orders HTTP with PostgreSQL', () => {
  let db: PrismaService;
  let app: INestApplication;
  let service: OrdersService;
  let jwt: JwtService;
  const customerId = randomUUID();
  const staffId = randomUUID();
  const otherId = randomUUID();
  const productId = randomUUID();
  const toppingId = randomUUID();
  const customerName = 'Khách kiểm thử Barista';
  const cookie = (id = staffId) =>
    `brewlite_session=${jwt.sign({ sub: id, sessionVersion: 0 })}`;
  const get = (path: string, id = staffId) =>
    request(app.getHttpServer()).get(`/api${path}`).set('Cookie', cookie(id));
  const patch = (id: string, action: string, body: object) =>
    request(app.getHttpServer())
      .patch(`/api/staff/orders/${id}/${action}`)
      .set('Cookie', cookie())
      .set('Origin', 'http://localhost:3000')
      .send(body);
  const cancel = (id: string, reason = ' Hết nguyên liệu ') =>
    patch(id, 'cancel', { reason });
  const transition = (id: string, status: OrderStatus) =>
    patch(id, 'status', { status });
  const row = (id: string) => db.order.findUniqueOrThrow({ where: { id } });
  const stock = async () =>
    (await db.product.findUniqueOrThrow({ where: { id: productId } })).stock;
  const history = (id: string) =>
    db.orderStatusHistory.findMany({
      where: { orderId: id },
      orderBy: { version: 'asc' },
    });

  async function create(status: OrderStatus = 'PENDING') {
    const order = await service.create(customerId, {
      items: [
        {
          productId,
          size: 'M',
          toppingIds: [toppingId],
          quantity: 1,
          ice: '70% đá',
          sugar: '50% đường',
          note: 'Ít nóng',
        },
      ],
    });
    if (status === 'PAYMENT_FAILED') {
      await db.$transaction((tx) =>
        service.transitionInTransaction(tx, order.id, status),
      );
    } else if (status !== 'PENDING') {
      // Payment integration boundary: the staff HTTP API must never mark PAID.
      await db.$transaction((tx) =>
        service.transitionInTransaction(tx, order.id, 'PAID'),
      );
      for (const next of ['PREPARING', 'READY', 'COMPLETED'] as const) {
        if ((await row(order.id)).status === status) break;
        await service.staffTransition(order.id, next);
      }
    }
    return order.id;
  }

  beforeAll(async () => {
    db = new PrismaService({ datasources: { db: { url: databaseUrl! } } });
    await db.$connect();
    for (const id of [customerId, staffId, otherId]) {
      await db.user.create({
        data: {
          id,
          email: `${id}@staff.test`,
          fullName: customerName,
          passwordHash: 'test-only-not-a-login',
          role: id === staffId ? 'BARISTA' : 'CUSTOMER',
        },
      });
    }
    await db.topping.create({ data: { id: toppingId, name: 'Kem cheese' } });
    await db.product.create({
      data: {
        id: productId,
        name: 'Cacao',
        price: 30000,
        imageUrl: '/test.svg',
        stock: 20,
        sizes: { create: { code: 'M', name: 'Medium', extraPrice: 5000 } },
        toppings: { create: { toppingId, extraPrice: 6000 } },
      },
    });
    process.env.JWT_SECRET = 'staff-postgres-test-only';
    process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    service = module.get(OrdersService);
    jwt = module.get(JwtService);
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
    await db.order.deleteMany({ where: { userId: customerId } });
    await db.product.update({
      where: { id: productId },
      data: { stock: 20, version: 1 },
    });
  });
  afterAll(async () => {
    if (!db) return;
    await db.order.deleteMany({ where: { userId: customerId } });
    await db.product.deleteMany({ where: { id: productId } });
    await db.topping.deleteMany({ where: { id: toppingId } });
    await db.user.deleteMany({
      where: { id: { in: [customerId, staffId, otherId] } },
    });
    await app?.close();
    await db.$disconnect();
  });

  it('returns full detail to Barista without exposing private account fields', async () => {
    const id = await create();
    const response = await get(`/staff/orders/${id}`).expect(200);
    expect(response.body).toMatchObject({
      id,
      customerName,
      total: 41000,
      status: 'PENDING',
      items: [
        {
          name: 'Cacao',
          size: 'M',
          toppingNames: ['Kem cheese'],
          ice: '70% đá',
          sugar: '50% đường',
          note: 'Ít nóng',
        },
      ],
    });
    expect(response.body).not.toHaveProperty('user');
    expect(response.body).not.toHaveProperty('passwordHash');
    expect(response.body).not.toHaveProperty('email');
    await get(`/staff/orders/${id}`, customerId).expect(403);
    await get(`/staff/orders/${randomUUID()}`).expect(404);
    await cancel(randomUUID()).expect(404);
    await get(`/orders/${id}`, otherId).expect(404);
  });

  it.each(['PENDING', 'PAID', 'PAYMENT_FAILED'] as const)(
    'cancels %s with a trimmed reason, correct inventory, history and customer visibility',
    async (status) => {
      const id = await create(status);
      const before = await row(id);
      const result = await cancel(id).expect(200);
      expect(result.body).toMatchObject({
        status: 'CANCELLED',
        cancelReason: 'Hết nguyên liệu',
        customerName,
      });
      expect(result.body).not.toHaveProperty('completedAt');
      expect(await row(id)).toMatchObject({
        cancelReason: 'Hết nguyên liệu',
        completedAt: null,
        inventoryHeld: false,
        version: before.version + 1,
      });
      expect(await stock()).toBe(20);
      const events = await history(id);
      expect(events.at(-1)).toMatchObject({
        fromStatus: status,
        toStatus: 'CANCELLED',
        version: before.version + 1,
      });
      await get(`/orders/${id}`, customerId)
        .expect(200)
        .expect(({ body }) => {
          expect(body.cancelReason).toBe('Hết nguyên liệu');
          expect(body.status).toBe('CANCELLED');
        });
      await cancel(id, 'Không được ghi đè lý do').expect(409);
      expect(await row(id)).toMatchObject({
        cancelReason: 'Hết nguyên liệu',
        version: before.version + 1,
      });
      expect(await stock()).toBe(20);
      expect(await history(id)).toHaveLength(events.length);
    },
  );

  it('validates reasons and blocks cancellation through status and internal calls without a reason', async () => {
    const id = await create('PAID');
    const before = await row(id);
    for (const reason of [
      undefined,
      null,
      123,
      [],
      {},
      '',
      ' \t\n ',
      'x'.repeat(301),
    ]) {
      await patch(id, 'cancel', { reason }).expect(400);
    }
    await transition(id, 'CANCELLED').expect(400);
    await expect(service.staffTransition(id, 'CANCELLED')).rejects.toThrow();
    await expect(
      db.$transaction((tx) =>
        service.transitionInTransaction(tx, id, 'CANCELLED'),
      ),
    ).rejects.toThrow();
    expect(await row(id)).toEqual(before);
    expect(await stock()).toBe(19);
    await cancel(id, 'x'.repeat(300)).expect(200);
  });

  it.each(['PREPARING', 'READY', 'COMPLETED'] as const)(
    'rejects cancellation from %s without changing fields, stock or history',
    async (status) => {
      const id = await create(status);
      const before = await row(id);
      const events = await history(id);
      await cancel(id).expect(409);
      expect(await row(id)).toEqual(before);
      expect(await history(id)).toEqual(events);
      expect(await stock()).toBe(19);
    },
  );

  it('records the actual handover time and shares the completed state with the customer', async () => {
    const id = await create('PAID');
    const oldDate = new Date('2020-01-01T00:00:00Z');
    await db.order.update({ where: { id }, data: { createdAt: oldDate } });
    await transition(id, 'COMPLETED').expect(409);
    await transition(id, 'PREPARING').expect(200);
    await transition(id, 'READY').expect(200);
    expect((await row(id)).completedAt).toBeNull();
    const before = Date.now();
    const response = await transition(id, 'COMPLETED').expect(200);
    const completed = new Date(response.body.completedAt).getTime();
    expect(completed).toBeGreaterThanOrEqual(before);
    expect(completed).toBeLessThanOrEqual(Date.now());
    expect((await history(id)).at(-1)?.createdAt.toISOString()).toBe(
      response.body.completedAt,
    );
    await get(`/orders/${id}`, customerId)
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe('COMPLETED');
        expect(body.completedAt).toBe(response.body.completedAt);
      });
    await transition(id, 'COMPLETED').expect(409);
    await transition(id, 'PREPARING').expect(409);
    expect((await row(id)).completedAt?.toISOString()).toBe(
      response.body.completedAt,
    );
    expect(await stock()).toBe(19);
  });

  it('lists active and terminal orders in deterministic creation order, excluding unpaid orders', async () => {
    const statuses = [
      'PENDING',
      'PAYMENT_FAILED',
      'PAID',
      'PREPARING',
      'READY',
      'COMPLETED',
    ] as const;
    const ids: string[] = [];
    for (const status of statuses) ids.push(await create(status));
    const cancelled = await create();
    await cancel(cancelled).expect(200);
    const visible = [...ids.slice(2), cancelled];
    for (const id of visible) {
      await db.order.update({
        where: { id },
        data: { createdAt: new Date('2026-01-01T00:00:00Z') },
      });
    }
    const response = await get('/staff/orders').expect(200);
    const ours = response.body.filter(
      (o: { userId: string }) => o.userId === customerId,
    );
    expect(ours.map((o: { id: string }) => o.id)).toEqual([...visible].sort());
    expect(
      ours.find((o: { id: string }) => o.id === cancelled).cancelReason,
    ).toBe('Hết nguyên liệu');
    expect(
      ours.find((o: { status: string }) => o.status === 'COMPLETED')
        .completedAt,
    ).toBeTruthy();
  });

  it('allows only one concurrent cancel and preserves its reason with a single stock release', async () => {
    const id = await create('PAID');
    const responses = await Promise.all([
      cancel(id, 'Lý do A'),
      cancel(id, 'Lý do B'),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = responses.find((r) => r.status === 200)!;
    expect((await row(id)).cancelReason).toBe(winner.body.cancelReason);
    expect(await stock()).toBe(20);
    expect(
      (await history(id)).filter((h) => h.toStatus === 'CANCELLED'),
    ).toHaveLength(1);
  });

  it('serializes a cancel versus start-preparing race', async () => {
    const id = await create('PAID');
    const responses = await Promise.all([
      cancel(id),
      transition(id, 'PREPARING'),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const persisted = await row(id);
    expect(await stock()).toBe(persisted.status === 'CANCELLED' ? 20 : 19);
    expect(persisted.cancelReason).toBe(
      persisted.status === 'CANCELLED' ? 'Hết nguyên liệu' : null,
    );
    expect(await history(id)).toHaveLength(3);
  });

  it('rolls back the reason, state, inventory and history when the transaction fails', async () => {
    const id = await create('PAID');
    const before = await row(id);
    await expect(
      db.$transaction(async (tx) => {
        await service.transitionInTransaction(
          tx,
          id,
          'CANCELLED',
          'Hết nguyên liệu',
        );
        throw new Error('forced transaction failure');
      }),
    ).rejects.toThrow('forced transaction failure');
    expect(await row(id)).toEqual(before);
    expect(await stock()).toBe(19);
    expect(await history(id)).toHaveLength(2);
  });

  it('backfills completion from real history in the migration and preserves legacy cancellations', async () => {
    // Temporary tables shadow real tables on this transaction connection only.
    await db.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(
        'CREATE TEMP TABLE orders (id TEXT, status TEXT) ON COMMIT DROP',
      );
      await tx.$executeRawUnsafe(
        'CREATE TEMP TABLE order_status_history (order_id TEXT, to_status TEXT, created_at TIMESTAMP(3)) ON COMMIT DROP',
      );
      await tx.$executeRawUnsafe(
        "INSERT INTO orders VALUES ('complete', 'COMPLETED'), ('missing', 'COMPLETED'), ('cancel', 'CANCELLED'), ('paid', 'PAID')",
      );
      await tx.$executeRawUnsafe(
        "INSERT INTO order_status_history VALUES ('complete', 'READY', '2026-01-01'), ('complete', 'COMPLETED', '2026-01-02')",
      );
      const migration = readFileSync(
        'prisma/migrations/20261016000100_staff_order_details/migration.sql',
        'utf8',
      );
      for (const sql of migration
        .split(/;\s*(?:\r?\n|$)/)
        .filter((part) => part.trim())) {
        await tx.$executeRawUnsafe(sql);
      }
      const result = await tx.$queryRawUnsafe<
        {
          id: string;
          cancel_reason: string | null;
          completed_at: Date | null;
        }[]
      >('SELECT * FROM orders ORDER BY id');
      expect(
        result.find((r) => r.id === 'complete')?.completed_at?.toISOString(),
      ).toBe('2026-01-02T00:00:00.000Z');
      expect(result.every((r) => r.cancel_reason === null)).toBe(true);
      expect(
        result
          .filter((r) => r.id !== 'complete')
          .every((r) => r.completed_at === null),
      ).toBe(true);
    });
  });
});
