import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Role, UserStatus, type ProductSizeCode } from '@prisma/client';
import request from 'supertest';
import { PrismaService } from '../prisma.service';
import type { ProductDetailRecord } from '../products/product-detail';
import { productDetailFixture } from '../../test/fixtures/product-detail';
import { CartModule } from './cart.module';

type Row = {
  id: string; cartId: string; productId: string; size: ProductSizeCode; toppingIds: string[];
  ice: string; sugar: string; note: string; configKey: string; quantity: number; createdAt: Date;
};
type ItemWhere = { id?: string; cartId?: string; productId?: string; cart?: { userId: string } };

const ALICE = '00000000-0000-4000-8000-00000000000a';
const BOB = '00000000-0000-4000-8000-00000000000b';
const product: ProductDetailRecord = { ...productDetailFixture(), stock: 5 };
const espresso = product.toppings[0].topping.id;
const line = (extra: Record<string, unknown> = {}) => ({
  productId: product.id, size: 'M', toppingIds: [espresso], quantity: 2, ice: '70% đá', sugar: '50% ít ngọt', ...extra,
});

// Real HTTP, ValidationPipe, JWT guard and CartService; only Prisma is an in-memory fake.
function fakePrisma(products: Map<string, ProductDetailRecord>) {
  const carts: { id: string; userId: string }[] = [];
  let rows: Row[] = [];
  let tick = 0;
  const matches = (where: ItemWhere) => (row: Row) =>
    (!where.id || row.id === where.id) &&
    (!where.cartId || row.cartId === where.cartId) &&
    (!where.productId || row.productId === where.productId) &&
    (!where.cart || carts.find((cart) => cart.id === row.cartId)?.userId === where.cart.userId);
  const project = (row: Row, args: { include?: unknown; select?: Record<string, boolean> }) =>
    args.include
      ? { ...row, product: products.get(row.productId) }
      : args.select
        ? Object.fromEntries(Object.keys(args.select).map((key) => [key, row[key as keyof Row]]))
        : row;
  const client = {
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        [ALICE, BOB].includes(where.id) ? { id: where.id, email: `${where.id}@test`, fullName: 'Khách', role: Role.CUSTOMER, loyaltyPoints: 0, status: UserStatus.ACTIVE } : null,
    },
    product: {
      findUnique: async ({ where }: { where: { id: string } }) => products.get(where.id) ?? null,
    },
    cart: {
      upsert: async ({ where }: { where: { userId: string } }) => {
        let cart = carts.find((item) => item.userId === where.userId);
        if (!cart) carts.push((cart = { id: randomUUID(), userId: where.userId }));
        return { id: cart.id };
      },
    },
    cartItem: {
      findMany: async (args: { where: ItemWhere; include?: unknown; select?: Record<string, boolean> }) =>
        rows.filter(matches(args.where)).sort((a, b) => +a.createdAt - +b.createdAt).map((row) => project(row, args)),
      findFirst: async (args: { where: ItemWhere; include?: unknown }) => {
        const row = rows.find(matches(args.where));
        return row ? project(row, args) : null;
      },
      create: async ({ data }: { data: Omit<Row, 'id' | 'createdAt'> }) => {
        const row = { ...data, id: randomUUID(), createdAt: new Date(Date.now() + tick++) };
        rows.push(row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) =>
        Object.assign(rows.find((row) => row.id === where.id)!, data),
      delete: async ({ where }: { where: { id: string } }) => {
        rows = rows.filter((row) => row.id !== where.id);
      },
      deleteMany: async ({ where }: { where: ItemWhere }) => {
        const before = rows.length;
        rows = rows.filter((row) => !matches(where)(row));
        return { count: before - rows.length };
      },
    },
    $transaction: async (work: (tx: unknown) => Promise<void>) => work(client),
    reset: () => {
      carts.length = 0;
      rows = [];
    },
  };
  return client;
}

describe('Cart HTTP', () => {
  let app: INestApplication;
  let token: (userId: string) => string;
  const products = new Map([[product.id, product]]);
  const prisma = fakePrisma(products);
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret-long-enough-for-cart-tests';
    const module = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), CartModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    const jwt = module.get(JwtService);
    token = (userId) => `Bearer ${jwt.sign({ sub: userId })}`;
  });
  beforeEach(() => {
    prisma.reset();
    product.stock = 5;
  });
  afterAll(async () => {
    await app?.close();
  });

  it('requires login for every cart route', async () => {
    await api().get('/api/cart').expect(401);
    await api().post('/api/cart/items').send(line()).expect(401);
  });

  it('starts empty, adds a line with server-computed price and merges identical configurations', async () => {
    const empty = await api().get('/api/cart').set('Authorization', token(ALICE)).expect(200);
    expect(empty.body).toEqual({ items: [], totalQuantity: 0, subtotal: 0, valid: true });

    // unitPrice sent by a client is not part of the contract and is rejected.
    await api().post('/api/cart/items').set('Authorization', token(ALICE)).send(line({ unitPrice: 1 })).expect(400);

    const first = await api().post('/api/cart/items').set('Authorization', token(ALICE)).send(line()).expect(201);
    expect(first.body.items).toHaveLength(1);
    expect(first.body.items[0]).toMatchObject({
      name: product.name, size: 'M', toppingNames: ['Thêm espresso'], quantity: 2,
      unitPrice: 40000, lineTotal: 80000, available: true,
    });
    expect(first.body.items[0].sizeOptions).toHaveLength(3);

    const merged = await api().post('/api/cart/items').set('Authorization', token(ALICE))
      .send(line({ quantity: 1, toppingIds: [espresso.toUpperCase()] })).expect(201);
    expect(merged.body.items).toHaveLength(1);
    expect(merged.body).toMatchObject({ totalQuantity: 3, subtotal: 120000 });

    const other = await api().post('/api/cart/items').set('Authorization', token(ALICE))
      .send(line({ quantity: 1, size: 'S', toppingIds: [], note: 'mang đi' })).expect(201);
    expect(other.body.items).toHaveLength(2);
    expect(other.body.items[1]).toMatchObject({ unitPrice: 29000, note: 'mang đi' });
  });

  it('validates input and product options', async () => {
    const auth = token(ALICE);
    await api().post('/api/cart/items').set('Authorization', auth).send(line({ quantity: 0 })).expect(400);
    await api().post('/api/cart/items').set('Authorization', auth).send(line({ size: 'XL' })).expect(400);
    await api().post('/api/cart/items').set('Authorization', auth).send(line({ ice: 'nhiều đá' })).expect(400);
    await api().post('/api/cart/items').set('Authorization', auth).send(line({ note: 'x'.repeat(121) })).expect(400);
    await api().post('/api/cart/items').set('Authorization', auth).send(line({ productId: randomUUID() })).expect(404);
    const unavailable = await api().post('/api/cart/items').set('Authorization', auth).send(line({ size: 'L' })).expect(422);
    expect(unavailable.body.message).toBe('Size L tạm hết');
  });

  it('enforces stock across all lines of the same product', async () => {
    const auth = token(ALICE);
    await api().post('/api/cart/items').set('Authorization', auth).send(line({ quantity: 4 })).expect(201);
    const over = await api().post('/api/cart/items').set('Authorization', auth).send(line({ size: 'S', quantity: 2 })).expect(409);
    expect(over.body.message).toBe(`${product.name} chỉ còn 5 phần`);

    // Stock dropping afterwards flags the line instead of hiding it, and decreasing is still allowed.
    product.stock = 2;
    const flagged = await api().get('/api/cart').set('Authorization', auth).expect(200);
    expect(flagged.body.valid).toBe(false);
    expect(flagged.body.items[0].issue).toBe(`${product.name} chỉ còn 2 phần`);
    const id = flagged.body.items[0].id;
    await api().patch(`/api/cart/items/${id}`).set('Authorization', auth).send({ quantity: 3 }).expect(200);
    const fixed = await api().patch(`/api/cart/items/${id}`).set('Authorization', auth).send({ quantity: 2 }).expect(200);
    expect(fixed.body.valid).toBe(true);
  });

  it('updates quantity and size, re-pricing and merging into an existing line', async () => {
    const auth = token(ALICE);
    await api().post('/api/cart/items').set('Authorization', auth).send(line({ size: 'S', quantity: 1 })).expect(201);
    const both = await api().post('/api/cart/items').set('Authorization', auth).send(line({ size: 'M', quantity: 1 })).expect(201);
    const [small, medium] = both.body.items;

    await api().patch(`/api/cart/items/${small.id}`).set('Authorization', auth).send({}).expect(400);
    await api().patch(`/api/cart/items/${small.id}`).set('Authorization', auth).send({ size: 'L' }).expect(422);
    const qty = await api().patch(`/api/cart/items/${medium.id}`).set('Authorization', auth).send({ quantity: 3 }).expect(200);
    expect(qty.body.items[1]).toMatchObject({ quantity: 3, lineTotal: 120000 });

    const mergedSize = await api().patch(`/api/cart/items/${small.id}`).set('Authorization', auth).send({ size: 'M' }).expect(200);
    expect(mergedSize.body.items).toHaveLength(1);
    expect(mergedSize.body.items[0]).toMatchObject({ id: medium.id, size: 'M', quantity: 4, unitPrice: 40000 });
  });

  it('keeps carts private per user and supports remove/clear', async () => {
    const added = await api().post('/api/cart/items').set('Authorization', token(ALICE)).send(line()).expect(201);
    const id = added.body.items[0].id;
    expect((await api().get('/api/cart').set('Authorization', token(BOB)).expect(200)).body.items).toEqual([]);
    await api().patch(`/api/cart/items/${id}`).set('Authorization', token(BOB)).send({ quantity: 1 }).expect(404);
    await api().delete(`/api/cart/items/${id}`).set('Authorization', token(BOB)).expect(404);
    await api().delete('/api/cart/items/not-a-uuid').set('Authorization', token(ALICE)).expect(400);

    const removed = await api().delete(`/api/cart/items/${id}`).set('Authorization', token(ALICE)).expect(200);
    expect(removed.body.items).toEqual([]);
    await api().post('/api/cart/items').set('Authorization', token(ALICE)).send(line()).expect(201);
    const cleared = await api().delete('/api/cart').set('Authorization', token(ALICE)).expect(200);
    expect(cleared.body).toMatchObject({ items: [], subtotal: 0 });
  });

  it('merges a guest cart after login and reports skipped lines', async () => {
    const auth = token(ALICE);
    await api().post('/api/cart/items').set('Authorization', auth).send(line({ quantity: 1 })).expect(201);
    const result = await api().post('/api/cart/merge').set('Authorization', auth).send({
      items: [line({ quantity: 1 }), line({ size: 'L' }), line({ productId: randomUUID() })],
    }).expect(200);
    expect(result.body.items).toHaveLength(1);
    expect(result.body.items[0].quantity).toBe(2);
    expect(result.body.skipped).toEqual([
      { productId: product.id, reason: 'Size L tạm hết' },
      { productId: expect.any(String), reason: 'Không tìm thấy sản phẩm' },
    ]);
    await api().post('/api/cart/merge').set('Authorization', auth).send({ items: [line({ quantity: 'x' })] }).expect(400);
  });
});
