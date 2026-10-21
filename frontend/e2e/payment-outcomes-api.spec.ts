import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../backend/node_modules/@prisma/client';

const databaseUrl = process.env.BREWLITE_PAYMENT_TEST_DATABASE_URL;
test.skip(!process.env.BREWLITE_RUN_PAYMENT_OUTCOMES_E2E || !databaseUrl,
  'Requires API-mode app, sandbox gateway controls, and the app database URL');

const db = new PrismaClient({ datasources: { db: { url: databaseUrl || 'postgresql://unused:unused@localhost:1/unused' } } });
const productId = randomUUID();
const email = `qa-payments-${randomUUID()}@example.test`;
const password = `BrewLite-${randomUUID()}`;
let userId: string | undefined;

test.beforeAll(async () => {
  await db.$connect();
  await db.product.create({ data: {
    id: productId, name: 'Cà phê kiểm thử thanh toán', description: 'Sản phẩm kiểm thử tự động',
    imageUrl: '/images/products/sample-milk-coffee.svg', price: 30000, stock: 10,
    sizes: { create: [
      { code: 'S', name: 'Nhỏ (S)', extraPrice: 0 },
      { code: 'M', name: 'Vừa (M)', extraPrice: 0, isDefault: true },
      { code: 'L', name: 'Lớn (L)', extraPrice: 5000 },
    ] },
  } });
});
test.afterAll(async () => {
  if (userId) {
    await db.payment.deleteMany({ where: { userId } });
    await db.order.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
  }
  await db.product.deleteMany({ where: { id: productId } });
  await db.$disconnect();
});

test('checkout shows success, failure and unknown from the real payment API', async ({ page }) => {
  await page.goto('/checkout?qa=1');
  await expect(page).toHaveURL(/\/login\?next=/);
  expect(new URL(page.url()).searchParams.get('next')).toBe('/checkout?qa=1');
  await page.goto('/register');
  await page.getByLabel('Họ tên').fill('Khách kiểm thử thanh toán');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Xác nhận mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  userId = (await db.user.findUniqueOrThrow({ where: { email } })).id;

  for (const outcome of [
    { value: 'PAID', route: 'success', order: 'PAID', width: 1440 },
    { value: 'PAYMENT_FAILED', route: 'failure', order: 'PAYMENT_FAILED', width: 768 },
    { value: 'UNKNOWN', route: 'unknown', order: 'PENDING', width: 390 },
  ] as const) {
    await page.setViewportSize({ width: outcome.width, height: 900 });
    if (outcome.value === 'PAID' || outcome.value === 'PAYMENT_FAILED') {
      await page.goto(`/products/${productId}`);
      await page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }).click();
      await expect(page).toHaveURL(/\/cart$/);
    }
    await page.goto('/checkout');
    await expect(page.getByLabel('Kết quả thanh toán kiểm thử')).toHaveCount(0);
    await page.getByRole('button', { name: 'Kiểm thử thanh toán', exact: true }).click();
    await expect(page).toHaveURL(/\/checkout\?qa=1$/);
    await page.getByLabel('Kết quả thanh toán kiểm thử').selectOption(outcome.value);
    const layout = await page.evaluate(() => ({
      width: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowing: [...document.querySelectorAll('body *')]
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 5).map((element) => `${element.tagName}.${element.className}`),
    }));
    expect(layout.scrollWidth, JSON.stringify(layout)).toBeLessThanOrEqual(layout.width);
    if (outcome.value === 'PAYMENT_FAILED')
      await page.getByRole('button', { name: 'Thẻ ngân hàng' }).click();
    await page.getByRole('button', { name: /Xác nhận thanh toán/ }).click();
    await expect(page).toHaveURL(new RegExp(`/payment/[^/]+/${outcome.route}$`));
    const orderId = new URL(page.url()).pathname.split('/')[2];
    await expect.poll(async () => (await db.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe(outcome.order);
    expect(await db.payment.count({ where: { orderId, status: outcome.value } })).toBe(1);
    if (outcome.value === 'PAID') {
      await expect(page.getByRole('heading', { name: 'Đặt hàng thành công!' })).toBeVisible();
      expect(await db.loyaltyLog.count({ where: { orderId } })).toBe(1);
    } else if (outcome.value === 'PAYMENT_FAILED') {
      await expect(page.getByRole('heading', { name: 'Thanh toán chưa thành công' })).toBeVisible();
      expect(await db.loyaltyLog.count({ where: { orderId } })).toBe(0);
    } else {
      await expect(page.getByRole('heading', { name: 'Đang xác minh kết quả thanh toán' })).toBeVisible();
      expect(await db.loyaltyLog.count({ where: { orderId } })).toBe(0);
    }
  }
});
