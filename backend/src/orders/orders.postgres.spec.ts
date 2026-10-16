import { randomUUID } from 'node:crypto';
import { ConflictException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module';
import { cookieOriginGuard } from '../auth/csrf.middleware';
import { PrismaService } from '../prisma.service';
import { InventoryService } from '../inventory/inventory.service';
import { OrdersService } from './orders.service';
import { NoPromotionDiscount } from './order-discount';
import type { CreateOrderDto } from './dto/create-order.dto';

// Opt in with a migrated, dedicated test database. Never fall back to DATABASE_URL.
const databaseUrl = process.env.ORDERS_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('Orders PostgreSQL transactions and concurrency', () => {
  let db: PrismaService;
  let service: OrdersService;
  const userId = randomUUID();
  const productIds = [randomUUID(), randomUUID()].sort();
  const toppingId = randomUUID();
  const dto = (ids = [productIds[0]]): CreateOrderDto => ({
    items: ids.map((productId) => ({
      productId,
      size: 'M',
      toppingIds: [toppingId],
      quantity: 1,
      ice: '70% đá',
      sugar: '50% ít ngọt',
    })),
  });

  beforeAll(async () => {
    db = new PrismaService({ datasources: { db: { url: databaseUrl! } } });
    service = new OrdersService(
      db,
      new InventoryService(),
      new NoPromotionDiscount(),
    );
    await db.$connect();
    await db.user.create({
      data: {
        id: userId,
        email: `${userId}@orders.test`,
        fullName: 'Orders test',
        passwordHash: 'not-a-login',
      },
    });
    await db.topping.create({ data: { id: toppingId, name: 'Test topping' } });
    for (const id of productIds) {
      await db.product.create({
        data: {
          id,
          name: 'Orders test',
          price: 29000,
          imageUrl: '/test.svg',
          stock: 1,
          sizes: { create: { code: 'M', name: 'Medium', extraPrice: 5000 } },
          toppings: { create: { toppingId, extraPrice: 6000 } },
        },
      });
    }
  });
  beforeEach(async () => {
    await db.order.deleteMany({ where: { userId } });
    await db.product.updateMany({
      where: { id: { in: productIds } },
      data: { stock: 1, version: 1, price: 29000 },
    });
  });
  afterAll(async () => {
    if (!db) return;
    // Only fixtures belonging to this run; no truncate/reset or deletion of seed data.
    await db.order.deleteMany({ where: { userId } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.topping.deleteMany({ where: { id: toppingId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it('allows exactly one of eight concurrent last-unit orders', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () => service.create(userId, dto())),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    for (const result of results)
      if (result.status === 'rejected')
        expect(result.reason).toBeInstanceOf(ConflictException);
    expect(await db.order.count({ where: { userId } })).toBe(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: productIds[0] } }))
        .stock,
    ).toBe(0);
  });

  it('rolls back an earlier product decrement if a later product has no stock', async () => {
    await db.product.update({
      where: { id: productIds[1] },
      data: { stock: 0 },
    });
    await expect(service.create(userId, dto(productIds))).rejects.toThrow(
      ConflictException,
    );
    expect(await db.order.count({ where: { userId } })).toBe(0);
    expect(
      await db.product.findUniqueOrThrow({ where: { id: productIds[0] } }),
    ).toMatchObject({ stock: 1, version: 1 });
  });

  it('rolls back inventory if order persistence fails', async () => {
    await expect(service.create(randomUUID(), dto())).rejects.toThrow();
    expect(
      await db.product.findUniqueOrThrow({ where: { id: productIds[0] } }),
    ).toMatchObject({ stock: 1, version: 1 });
  });

  it('releases once under concurrent cancellation and writes only one transition', async () => {
    const order = await service.create(userId, dto());
    const results = await Promise.allSettled([
      service.staffCancel(order.id, 'Hết nguyên liệu'),
      service.staffCancel(order.id, 'Khách yêu cầu'),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: productIds[0] } }))
        .stock,
    ).toBe(1);
    expect(
      await db.orderStatusHistory.count({ where: { orderId: order.id } }),
    ).toBe(2);
  });

  it('keeps failed state if retry cannot reserve, then supports retry and the full lifecycle', async () => {
    const order = await service.create(userId, dto());
    await db.$transaction((tx) =>
      service.transitionInTransaction(tx, order.id, 'PAYMENT_FAILED'),
    );
    const competing = await service.create(userId, dto());
    await expect(
      db.$transaction((tx) =>
        service.transitionInTransaction(tx, order.id, 'PENDING'),
      ),
    ).rejects.toThrow(ConflictException);
    expect(
      await db.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({
      status: 'PAYMENT_FAILED',
      inventoryHeld: false,
      version: 2,
    });
    await service.staffCancel(competing.id, 'Khách yêu cầu');
    await db.$transaction((tx) =>
      service.transitionInTransaction(tx, order.id, 'PENDING'),
    );
    await db.$transaction((tx) =>
      service.transitionInTransaction(tx, order.id, 'PAID'),
    );
    for (const status of ['PREPARING', 'READY', 'COMPLETED'] as const)
      await service.staffTransition(order.id, status);
    expect((await service.get(order.id, userId)).status).toBe('COMPLETED');
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: productIds[0] } }))
        .stock,
    ).toBe(0);
    expect(
      await db.orderStatusHistory.count({ where: { orderId: order.id } }),
    ).toBe(7);
  });

  it('rolls back state, history and restored stock if the payment transaction fails', async () => {
    const order = await service.create(userId, dto());
    await expect(
      db.$transaction(async (tx) => {
        await service.transitionInTransaction(tx, order.id, 'PAYMENT_FAILED');
        throw new Error('payment write failed');
      }),
    ).rejects.toThrow('payment write failed');
    expect(
      await db.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ status: 'PENDING', inventoryHeld: true, version: 1 });
    expect(
      (await db.product.findUniqueOrThrow({ where: { id: productIds[0] } }))
        .stock,
    ).toBe(0);
    expect(
      await db.orderStatusHistory.count({ where: { orderId: order.id } }),
    ).toBe(1);
  });

  it('retains original line names and prices after catalog edits', async () => {
    const order = await service.create(userId, dto());
    await db.product.update({
      where: { id: productIds[0] },
      data: { name: 'Changed name', price: 99000 },
    });
    const stored = await service.get(order.id, userId);
    expect(stored.total).toBe(40000);
    expect(stored.items[0]).toMatchObject({
      name: 'Orders test',
      unitPrice: 40000,
      toppingNames: ['Test topping'],
    });
  });

  it('POST /orders persists a 45000 VND L+topping order and initial statusHistory using real PostgreSQL', async () => {
    await db.product.update({
      where: { id: productIds[0] },
      data: {
        price: 30000,
        sizes: { create: { code: 'L', name: 'Large', extraPrice: 9000 } },
      },
    });
    process.env.JWT_SECRET = 'orders-postgres-http-test-only';
    process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .compile();
    const app = module.createNestApplication({ logger: false });
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
    try {
      const cookie = `brewlite_session=${module.get(JwtService).sign({ sub: userId })}`;
      const payload = dto();
      payload.items[0].size = 'L';
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Cookie', cookie)
        .set('Origin', 'http://localhost:3000')
        .send(payload)
        .expect(201);
      expect(response.body).toMatchObject({
        userId,
        status: 'PENDING',
        subtotal: 45000,
        total: 45000,
      });
      const persisted = await db.order.findUniqueOrThrow({
        where: { id: response.body.id },
        include: { statusHistory: true },
      });
      expect(persisted.statusHistory).toHaveLength(1);
      expect(persisted.statusHistory[0]).toMatchObject({
        fromStatus: null,
        toStatus: 'PENDING',
        version: 1,
      });
      expect(
        (await db.product.findUniqueOrThrow({ where: { id: productIds[0] } }))
          .stock,
      ).toBe(0);
      await request(app.getHttpServer())
        .get(`/api/orders/${response.body.id}/status`)
        .set('Cookie', cookie)
        .expect(200, { status: 'PENDING' });
    } finally {
      await app.close();
    }
  });
});
