import { expect, test } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../backend/node_modules/@prisma/client';

const databaseUrl = process.env.BREWLITE_AUTH_TEST_DATABASE_URL;
test.skip(!process.env.BREWLITE_RUN_AUTH_SESSION_E2E || !databaseUrl,
  'Requires the running API-mode app and its dedicated test database URL');

const db = new PrismaClient({ datasources: { db: { url: databaseUrl || 'postgresql://unused:unused@localhost:1/unused' } } });
const email = `qa-relogin-${randomUUID()}@example.test`;
const password = `BrewLite-${randomUUID()}`;

test.afterAll(async () => {
  await db.user.deleteMany({ where: { email } });
  await db.$disconnect();
});

test('customer can register, log out, log in again, and coexist with Barista in a separate browser context', async ({ page, browser }) => {
  await page.goto('/register');
  await page.getByLabel('Họ tên').fill('Khách kiểm thử');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Xác nhận mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Đăng ký', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
  if (process.env.BARISTA_EMAIL && process.env.BARISTA_PASSWORD) {
    const staffContext = await browser.newContext();
    try {
      const staffPage = await staffContext.newPage();
      await staffPage.goto('/login');
      await staffPage.getByLabel('Email').fill(process.env.BARISTA_EMAIL);
      await staffPage.getByLabel('Mật khẩu', { exact: true }).fill(process.env.BARISTA_PASSWORD);
      await staffPage.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await expect(staffPage).toHaveURL(/\/barista\/dashboard$/);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Đăng xuất' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Trạm Barista' })).toHaveCount(0);
    } finally {
      await staffContext.close();
    }
  }
});
