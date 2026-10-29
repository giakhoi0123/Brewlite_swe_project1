import { randomUUID } from 'node:crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma.service';
import { OrdersService } from '../orders/orders.service';
import { cookieOriginGuard } from '../auth/csrf.middleware';
import type { CreateOrderDto } from '../orders/dto/create-order.dto';

const url = process.env.ORDERS_TEST_DATABASE_URL;
const database = url ? describe : describe.skip;
database('Ingredient inventory PostgreSQL and HTTP', () => {
  let db: PrismaService;
  let orders: OrdersService;
  let app: INestApplication;
  let staffCookie: string;
  let customerCookie: string;
  const customer = randomUUID(), staff = randomUUID();
  const products = [randomUUID(), randomUUID()];
  const milk = randomUUID(), coffee = randomUUID(), cream = randomUUID(), topping = randomUUID();
  const origin = 'http://localhost:3000';
  const savedSecret = process.env.JWT_SECRET, savedOrigin = process.env.FRONTEND_ORIGIN;
  const extraIngredients: string[] = [];
  const dto = (productId = products[0], quantity = 1, toppingIds: string[] = []): CreateOrderDto => ({
    items: [{ productId, quantity, toppingIds, size: 'M', ice: '70% đá', sugar: '50% ít ngọt' }],
  });
  const stocks = async () => Object.fromEntries((await db.ingredient.findMany({
    where: { id: { in: [milk, coffee, cream] } },
  })).map((i) => [i.id, i.stock.toString()]));
  const endpoint = (method: 'get' | 'post' | 'put', path: string, cookie = staffCookie) =>
    request(app.getHttpServer())[method](`/api/staff/inventory${path}`)
      .set('Cookie', cookie).set('Origin', origin);

  beforeAll(async () => {
    process.env.JWT_SECRET = 'ingredient-test-only-secret';
    process.env.FRONTEND_ORIGIN = origin;
    db = new PrismaService({ datasources: { db: { url: url! } } });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(db).compile();
    app = module.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.use(cookieOriginGuard);
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
    orders = module.get(OrdersService);
    for (const id of [customer, staff]) await db.user.create({ data: {
      id, email: `${id}@ingredients.test`, fullName: 'Ingredients test', passwordHash: 'not-a-login',
      role: id === staff ? 'BARISTA' : 'CUSTOMER',
    } });
    const jwt = module.get(JwtService);
    staffCookie = `brewlite_session=${jwt.sign({ sub: staff, sessionVersion: 0 })}`;
    customerCookie = `brewlite_session=${jwt.sign({ sub: customer, sessionVersion: 0 })}`;
    for (const id of [milk, coffee, cream]) await db.ingredient.create({
      data: { id, name: `Ingredient ${id}`, unit: id === coffee ? 'G' : 'ML', stock: 1000 },
    });
    await db.topping.create({ data: { id: topping, name: 'Cream' } });
    for (const id of products) await db.product.create({ data: {
      id, name: 'Ingredient coffee', price: 30000, imageUrl: '/test.svg', stock: 100,
      sizes: { create: [
        { code: 'S', name: 'S', extraPrice: 0 },
        { code: 'M', name: 'M', extraPrice: 4000, isDefault: true },
        { code: 'L', name: 'L', extraPrice: 9000 },
      ] },
      toppings: { create: { toppingId: topping, extraPrice: 6000 } },
    } });
  });

  beforeEach(async () => {
    await db.order.deleteMany({ where: { userId: customer } });
    await db.ingredient.updateMany({ where: { id: { in: [milk, coffee, cream] } }, data: { stock: 1000, version: 1 } });
    await db.product.updateMany({ where: { id: { in: products } }, data: { stock: 100, version: 1 } });
    const sizes = await db.productSize.findMany({ where: { productId: { in: products } } });
    await db.productRecipe.deleteMany({ where: { productSizeId: { in: sizes.map((s) => s.id) } } });
    for (const size of sizes) {
      const amounts = { S: [20, 10], M: [30, 20], L: [40, 30] }[size.code];
      await db.productRecipe.createMany({ data: [
        { productSizeId: size.id, ingredientId: milk, amount: amounts[0] },
        { productSizeId: size.id, ingredientId: coffee, amount: amounts[1] },
      ] });
    }
    await db.toppingRecipe.deleteMany({ where: { toppingId: topping } });
    await db.toppingRecipe.createMany({ data: [
      { toppingId: topping, ingredientId: milk, amount: 15 },
      { toppingId: topping, ingredientId: cream, amount: 10 },
    ] });
  });

  afterAll(async () => {
    if (db) {
      await db.order.deleteMany({ where: { userId: customer } });
      await db.product.deleteMany({ where: { id: { in: products } } });
      await db.topping.deleteMany({ where: { id: topping } });
      await db.ingredient.deleteMany({ where: { id: { in: [milk, coffee, cream, ...extraIngredients] } } });
      await db.user.deleteMany({ where: { id: { in: [customer, staff] } } });
    }
    await app?.close();
    if (savedSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = savedSecret;
    if (savedOrigin === undefined) delete process.env.FRONTEND_ORIGIN; else process.env.FRONTEND_ORIGIN = savedOrigin;
  });

  it('reports S=36/L=12 by UUID, checks the whole guest cart, and rejects stale checkout', async () => {
    await db.ingredient.update({ where: { id: coffee }, data: { stock: 360 } });
    const response = await request(app.getHttpServer()).get(`/api/products/${products[0]}`).expect(200);
    expect(response.body.sizes.find((s: { code: string }) => s.code === 'S')).toMatchObject({ stock: 36 });
    expect(response.body.sizes.find((s: { code: string }) => s.code === 'L')).toMatchObject({ stock: 12 });
    const items = [{ ...dto().items[0], size: 'S', quantity: 20 }, { ...dto().items[0], size: 'L', quantity: 6 }];
    await request(app.getHttpServer()).post('/api/products/availability').set('Origin', origin).send({ items }).expect(409);
    await db.ingredient.update({ where: { id: milk }, data: { stock: 200 } });
    const limited = await request(app.getHttpServer()).get(`/api/products/${products[0]}`).expect(200);
    expect(limited.body.sizes.find((s: { code: string }) => s.code === 'L').stock).toBe(5);
    await db.ingredient.update({ where: { id: coffee }, data: { stock: 0 } });
    await request(app.getHttpServer()).post('/api/orders').set('Cookie', customerCookie)
      .set('Origin', origin).send(dto()).expect(409);
    expect(await db.order.count({ where: { userId: customer } })).toBe(0);
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0] } })).stock).toBe(100);
  });

  it('uses size-specific recipes across multiple products and configurations', async () => {
    const input = dto(products[0], 2, [topping]);
    input.items.push({ ...dto(products[1]).items[0], size: 'L' });
    await orders.create(customer, input);
    expect(await stocks()).toEqual({ [milk]: '870', [coffee]: '930', [cream]: '980' });
  });

  it('checks complete server carts on add and size updates and rolls back rejected mutations', async () => {
    await db.ingredient.update({ where: { id: coffee }, data: { stock: 360 } });
    const call = (method: 'post' | 'patch', path: string) => request(app.getHttpServer())[method](path)
      .set('Cookie', customerCookie).set('Origin', origin);
    try {
      const added = await call('post', '/api/cart/items').send({ ...dto().items[0], size: 'S', quantity: 20 }).expect(201);
      await call('post', '/api/cart/items').send({ ...dto().items[0], size: 'L', quantity: 6 }).expect(409);
      await call('patch', `/api/cart/items/${added.body.items[0].id}`).send({ size: 'L' }).expect(409);
      const cart = await request(app.getHttpServer()).get('/api/cart').set('Cookie', customerCookie).expect(200);
      expect(cart.body.items).toHaveLength(1);
      expect(cart.body.items[0]).toMatchObject({ size: 'S', quantity: 20 });
      expect((await stocks())[coffee]).toBe('360');
    } finally { await db.cart.deleteMany({ where: { userId: customer } }); }
  });

  it('rejects a missing topping recipe without writing order or stock', async () => {
    await db.toppingRecipe.deleteMany({ where: { toppingId: topping } });
    await expect(orders.create(customer, dto(products[0], 1, [topping]))).rejects.toThrow('định mức');
    expect(await stocks()).toEqual({ [milk]: '1000', [coffee]: '1000', [cream]: '1000' });
    expect(await db.order.count({ where: { userId: customer } })).toBe(0);
  });

  it('rolls back the entire order and product stock when only the topping is short', async () => {
    await db.ingredient.update({ where: { id: cream }, data: { stock: 9 } });
    const before = await stocks();
    await expect(orders.create(customer, dto(products[0], 1, [topping]))).rejects.toThrow('Không đủ');
    expect(await stocks()).toEqual(before);
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0] } })).stock).toBe(100);
    expect(await db.order.count({ where: { userId: customer } })).toBe(0);
  });

  it('collects all missing ingredient names and rolls back order and stock when multiple ingredients are short', async () => {
    await db.ingredient.update({ where: { id: milk }, data: { stock: 10 } });
    await db.ingredient.update({ where: { id: coffee }, data: { stock: 5 } });
    const before = await stocks();
    const milkName = (await db.ingredient.findUniqueOrThrow({ where: { id: milk } })).name;
    const coffeeName = (await db.ingredient.findUniqueOrThrow({ where: { id: coffee } })).name;

    await expect(orders.create(customer, dto(products[0], 1))).rejects.toThrow(
      new RegExp(`Không đủ nguyên vật liệu:.*(${milkName}|${coffeeName}).*(${milkName}|${coffeeName}).*Vui lòng chọn món khác hoặc giảm số lượng!`),
    );
    expect(await stocks()).toEqual(before);
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0] } })).stock).toBe(100);
    expect(await db.order.count({ where: { userId: customer } })).toBe(0);
  });

  it('does not oversell a shared ingredient when different products race', async () => {
    await db.ingredient.update({ where: { id: milk }, data: { stock: 30 } });
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => orders.create(customer, dto(products[i % 2]))));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await stocks())[milk]).toBe('0');
    expect(await db.order.count({ where: { userId: customer } })).toBe(1);
    const stock = await db.product.aggregate({ where: { id: { in: products } }, _sum: { stock: true } });
    expect(stock._sum.stock).toBe(200);
  });

  it('releases and retries the original snapshot after recipes change; no double release', async () => {
    const order = await orders.create(customer, dto(products[0], 2, [topping]));
    await db.productRecipe.updateMany({ where: { productSize: { productId: products[0] } }, data: { amount: 999 } });
    await db.toppingRecipe.updateMany({ where: { toppingId: topping }, data: { amount: 999 } });
    await db.$transaction((tx) => orders.transitionInTransaction(tx, order.id, 'PAYMENT_FAILED'));
    expect(await stocks()).toEqual({ [milk]: '1000', [coffee]: '1000', [cream]: '1000' });
    await orders.preparePaymentRetry(order.id, customer);
    expect(await stocks()).toEqual({ [milk]: '910', [coffee]: '960', [cream]: '980' });
    await orders.staffCancel(order.id, 'Test cancel');
    await expect(orders.staffCancel(order.id, 'Again')).rejects.toThrow();
    expect((await stocks())[milk]).toBe('1000');
  });

  it('rolls back retry when ingredients were sold in the meantime', async () => {
    const order = await orders.create(customer, dto());
    await db.$transaction((tx) => orders.transitionInTransaction(tx, order.id, 'PAYMENT_FAILED'));
    await db.ingredient.update({ where: { id: milk }, data: { stock: 0 } });
    await expect(orders.preparePaymentRetry(order.id, customer)).rejects.toThrow();
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAYMENT_FAILED');
    expect((await db.product.findUniqueOrThrow({ where: { id: products[0] } })).stock).toBe(100);
  });

  it('keeps consumed ingredients out of usable stock when a preparing drink is cancelled', async () => {
    const order = await orders.create(customer, dto());
    await db.$transaction((tx) => orders.transitionInTransaction(tx, order.id, 'PAID'));
    await orders.staffTransition(order.id, 'PREPARING');
    await orders.staffCancel(order.id, 'Spilled');
    expect((await stocks())[milk]).toBe('970');
  });

  it('rolls back release when the surrounding payment transaction fails', async () => {
    const order = await orders.create(customer, dto());
    await expect(db.$transaction(async (tx) => {
      await orders.transitionInTransaction(tx, order.id, 'PAYMENT_FAILED');
      throw new Error('payment write failed');
    })).rejects.toThrow('payment write failed');
    expect((await stocks())[milk]).toBe('970');
    expect((await db.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
  });

  it('shows ingredient-limited cups and unavailable toppings in the public catalog', async () => {
    await db.ingredient.update({ where: { id: milk }, data: { stock: 61 } });
    await db.ingredient.update({ where: { id: cream }, data: { stock: 0 } });
    const result = await request(app.getHttpServer()).get(`/api/products/${products[0]}`).expect(200);
    expect(result.body.stock).toBe(3); // S uses 20 ml, M 30 ml, L 40 ml.
    expect(result.body.toppings[0].available).toBe(false);
  });

  it('allows staff to add, receive and configure ingredients; rejects invalid data and customer writes', async () => {
    await endpoint('post', '', customerCookie).send({ name: 'Forbidden', unit: 'G', stock: 1 }).expect(403);
    await endpoint('get', '', '').expect(401);
    await endpoint('post', '').send({ name: 'Bad', unit: 'G', stock: -1 }).expect(400);
    const created = await endpoint('post', '').send({ name: `Salt ${randomUUID()}`, unit: 'G', stock: 1.125 }).expect(201);
    extraIngredients.push(created.body.id);
    await endpoint('post', `/${created.body.id}/receipts`).send({ amount: 0.125 }).expect(201);
    expect((await db.ingredient.findUniqueOrThrow({ where: { id: created.body.id } })).stock.toString()).toBe('1.25');
    const size = await db.productSize.findFirstOrThrow({ where: { productId: products[0], code: 'M' } });
    const body = { ingredients: [{ ingredientId: milk, amount: 25 }, { ingredientId: created.body.id, amount: 0.125 }] };
    await endpoint('put', `/product-sizes/${size.id}/recipe`).send(body).expect(200);
    await orders.create(customer, dto(products[0], 2));
    expect((await db.ingredient.findUniqueOrThrow({ where: { id: created.body.id } })).stock.toString()).toBe('1');
    await endpoint('put', `/toppings/${topping}/recipe`).send({ ingredients: [{ ingredientId: milk, amount: 5 }] }).expect(200);
    await endpoint('put', `/product-sizes/${size.id}/recipe`).send({ ingredients: [] }).expect(400);
    await endpoint('put', `/product-sizes/${size.id}/recipe`).send({ ingredients: [body.ingredients[0], body.ingredients[0]] }).expect(400);
    await endpoint('post', `/${milk}/receipts`).send({ amount: 0.0001 }).expect(400);
    const recipes = await endpoint('get', '/recipes').expect(200);
    expect(recipes.body.sizes.find((s: { id: string }) => s.id === size.id).recipe).toHaveLength(2);
  });

  it('selects an available size when the configured default cannot be made', async () => {
    await db.ingredient.update({ where: { id: milk }, data: { stock: 20 } });
    const result = await request(app.getHttpServer()).get(`/api/products/${products[0]}`).expect(200);
    expect(result.body.stock).toBe(1);
    expect(result.body.defaultSizeId).toBe(result.body.sizes.find((s: { code: string }) => s.code === 'S').id);
    expect(result.body.sizes.find((s: { code: string }) => s.code === 'M').available).toBe(false);
  });

  it('enforces nonnegative stock and positive recipes at the database boundary', async () => {
    await expect(db.ingredient.update({ where: { id: milk }, data: { stock: -1 } })).rejects.toThrow();
    await expect(db.toppingRecipe.updateMany({ where: { toppingId: topping }, data: { amount: 0 } })).rejects.toThrow();
  });
});
