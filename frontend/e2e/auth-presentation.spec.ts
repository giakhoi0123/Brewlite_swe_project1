import { expect, test } from '@playwright/test';

test('login and registration hide passwords by default and toggle each field independently', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('Chế độ demo')).toHaveCount(0);

  const loginPassword = page.getByLabel('Mật khẩu', { exact: true });
  await expect(loginPassword).toHaveAttribute('type', 'password');
  await loginPassword.fill('Secret123');
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(loginPassword).toHaveAttribute('type', 'text');
  await expect(loginPassword).toHaveValue('Secret123');
  await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
  await expect(loginPassword).toHaveAttribute('type', 'password');

  await page.goto('/register');
  const password = page.getByLabel('Mật khẩu', { exact: true });
  const confirmation = page.getByLabel('Xác nhận mật khẩu', { exact: true });
  await expect(password).toHaveAttribute('type', 'password');
  await expect(confirmation).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Hiện mật khẩu xác nhận' }).click();
  await expect(password).toHaveAttribute('type', 'password');
  await expect(confirmation).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Ẩn mật khẩu xác nhận' }).click();
  await expect(confirmation).toHaveAttribute('type', 'password');
});

test('authentication layout stays within the viewport', async ({ page }) => {
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['/login', '/register']) {
      await page.goto(route);
      await expect(page.getByRole('button', { name: 'Hiện mật khẩu', exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    }
  }
});

test('membership call to action matches the current account state', async ({ page }) => {
  const cors = {
    'Access-Control-Allow-Origin': 'http://localhost:3000',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
  };
  await page.route('**/api/auth/me', (route) => route.fulfill(route.request().method() === 'OPTIONS'
    ? { status: 204, headers: cors }
    : { status: 401, contentType: 'application/json', headers: cors, body: '{"message":"Unauthorized"}' }));
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Tạo tài khoản/ })).toHaveAttribute('href', '/register');

  await page.unroute('**/api/auth/me');
  await page.route('**/api/cart', (route) => route.fulfill(route.request().method() === 'OPTIONS'
    ? { status: 204, headers: cors }
    : { status: 200, contentType: 'application/json', headers: cors,
        body: JSON.stringify({ items: [], totalQuantity: 0, subtotal: 0, valid: true }) }));
  await page.route('**/api/auth/me', (route) => route.fulfill(route.request().method() === 'OPTIONS'
    ? { status: 204, headers: cors }
    : { status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ user: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Tester',
      email: 'tester@example.test',
      role: 'CUSTOMER',
      loyaltyPoints: 7,
    } }) }));
  await page.reload();
  await expect(page.getByRole('link', { name: /Xem điểm của tôi/ })).toHaveAttribute('href', '/profile');
  await expect(page.getByText(/Tài khoản của bạn đã là thành viên BrewLite/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Tạo tài khoản/ })).toHaveCount(0);
});
