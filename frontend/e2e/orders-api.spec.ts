import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../backend/node_modules/@prisma/client';

const databaseUrl = process.env.ORDERS_TEST_DATABASE_URL;
const api = (process.env.BREWLITE_E2E_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
test.skip(!process.env.BREWLITE_RUN_ORDERS_E2E || !databaseUrl,
  'Opt in with API-mode frontend, real backend and a migrated dedicated ORDERS_TEST_DATABASE_URL');

// Only fixtures owned by this run are removed. Auth, Cart, Products and Orders all use real APIs/DB.
const db = new PrismaClient({ datasources: { db: { url: databaseUrl || 'postgresql://unused:unused@localhost:1/unused' } } });
let productId: string;
let toppingId: string;
let customerId: string | undefined;

test.beforeAll(async () => { await db.$connect(); });
test.beforeEach(async () => {
  productId = randomUUID(); toppingId = randomUUID(); customerId = undefined;
  await db.topping.create({ data: { id: toppingId, name: 'Task06 topping' } });
  await db.product.create({ data: {
    id: productId, name: 'Task06 Coffee', description: 'PostgreSQL checkout fixture',
    imageUrl: '/images/products/sample-milk-coffee.svg', price: 30000, stock: 8,
    sizes: { create: [
      { code: 'S', name: 'Nhỏ (S)', extraPrice: 0 },
      { code: 'M', name: 'Vừa (M)', extraPrice: 4000, isDefault: true },
      { code: 'L', name: 'Lớn (L)', extraPrice: 9000 },
    ] },
    toppings: { create: { toppingId, extraPrice: 6000 } },
  } });
});
test.afterEach(async () => {
  await db.order.deleteMany({ where: { items: { some: { productId } } } });
  if (customerId) await db.cart.deleteMany({ where: { userId: customerId } });
  await db.product.deleteMany({ where: { id: productId } });
  await db.topping.deleteMany({ where: { id: toppingId } });
  if (customerId) await db.user.deleteMany({ where: { id: customerId } });
});
test.afterAll(async () => { await db.$disconnect(); });

async function checkout(page: import('@playwright/test').Page) {
  // Task 06 ends at PENDING. Abort the later Task 08 request, without supplying a fake payment result.
  await page.route('**/api/payments', route => route.abort('blockedbyclient'));
  await page.goto(`/products/${productId}`);
  await expect(page.getByRole('heading', { name: 'Task06 Coffee', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Size L/ }).click();
  await page.getByRole('checkbox', { name: /Task06 topping/ }).check();
  await page.getByRole('button', { name: 'Tăng số lượng' }).click();
  await page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await page.getByRole('button', { name: /Tiến hành đặt hàng/ }).click();
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.getByRole('link', { name: 'Đăng ký ngay' }).click();
  const email = `task06-${randomUUID()}@example.test`;
  const password = `Task06-${randomUUID()}`;
  await page.getByLabel('Họ tên').fill('Khách Task06');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Xác nhận mật khẩu').fill(password);
  const registered = page.waitForResponse(r => r.url() === `${api}/auth/register` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  const registration = await registered;
  expect(registration.status()).toBe(201);
  customerId = (await registration.json()).user.id;
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByLabel('Kết quả thanh toán kiểm thử')).toHaveCount(0);
  await expect.poll(async () => db.cartItem.count({ where: { cart: { userId: customerId }, productId } })).toBe(1);
  await expect(page.getByRole('button', { name: 'Xác nhận thanh toán 90.000 ₫' })).toBeEnabled();
}

for (const width of [1440, 768, 390]) {
  test(`Task 06 API checkout persists a PENDING order at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await checkout(page);
    await page.screenshot({ path: testInfo.outputPath(`checkout-${width}.png`), fullPage: true });
    const created = page.waitForResponse(r => r.url() === `${api}/orders` && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Xác nhận thanh toán 90.000 ₫' }).click();
    const response = await created;
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ userId: customerId, status: 'PENDING', subtotal: 90000, discount: 0, total: 90000 });
    const sent = response.request().postDataJSON();
    expect(sent).not.toHaveProperty('userId');
    expect(sent).not.toHaveProperty('total');
    expect(sent.items[0]).not.toHaveProperty('unitPrice');
    const stored = await db.order.findUniqueOrThrow({ where: { id: body.id }, include: { items: true, statusHistory: true } });
    expect(stored).toMatchObject({ status: 'PENDING', userId: customerId, total: 90000, inventoryHeld: true });
    expect(stored.items[0]).toMatchObject({ productId, size: 'L', qty: 2, unitPrice: 45000, lineTotal: 90000 });
    expect(stored.statusHistory).toHaveLength(1);
    expect(await db.product.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({ stock: 6, version: 2 });
    expect(await db.cartItem.count({ where: { cart: { userId: customerId }, productId } })).toBe(1);
    expect(await db.payment.count({ where: { orderId: body.id } })).toBe(0);
    await page.goto(`/orders/${body.id}`);
    await expect(page.getByRole('heading', { name: `Mã đơn #${body.id}` })).toBeVisible();
    await expect(page.locator('.status.PENDING')).toBeVisible();
    await page.reload();
    await expect(page.locator('.status.PENDING')).toBeVisible();
    expect(await db.order.count({ where: { userId: customerId } })).toBe(1);
    await page.screenshot({ path: testInfo.outputPath(`pending-${width}.png`), fullPage: true });
  });
}

test('Task 06 API stock conflict keeps checkout/cart and creates no order', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await checkout(page);
  await db.product.update({ where: { id: productId }, data: { stock: 0, version: { increment: 1 } } });
  const created = page.waitForResponse(r => r.url() === `${api}/orders` && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Xác nhận thanh toán 90.000 ₫' }).click();
  expect((await created).status()).toBe(409);
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole('alert').filter({ hasText: 'không đủ tồn kho' })).toBeVisible();
  await expect(page.getByLabel('Giỏ hàng 2 món')).toBeVisible();
  expect(await db.order.count({ where: { userId: customerId } })).toBe(0);
  expect(await db.cartItem.count({ where: { cart: { userId: customerId }, productId } })).toBe(1);
});
