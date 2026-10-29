import { expect, test } from '@playwright/test';

// API-intercepted UI tests; not evidence of a live database or real authentication.
for (const width of [1440, 768, 390]) {
  test(`size stock, whole cart and stale inventory at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    let coffee = 360;
    let largeLimit = 12;
    const product = () => ({
      id: 'coffee', name: 'Cà phê kiểm thử', description: 'Cà phê', price: 30000,
      imageUrl: '/images/products/sample-milk-coffee.svg', stock: Math.floor(coffee / 10), defaultSizeId: 'size-s',
      sizes: [
        { id: 'size-s', code: 'S', name: 'Nhỏ', extraPrice: 0, available: coffee >= 10, stock: Math.floor(coffee / 10) },
        { id: 'size-m', code: 'M', name: 'Vừa', extraPrice: 4000, available: false, stock: 0 },
        { id: 'size-l', code: 'L', name: 'Lớn', extraPrice: 9000, available: largeLimit > 0 && coffee >= 30, stock: Math.min(largeLimit, Math.floor(coffee / 30)) },
      ], toppings: [{ id: 'espresso', name: 'Thêm espresso', extraPrice: 5000, available: true }],
    });
    const posted: { size: string; quantity: number; toppingIds: string[] }[][] = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const headers = { 'Access-Control-Allow-Origin': new URL(page.url()).origin, 'Access-Control-Allow-Credentials': 'true' };
      let status = 200;
      let body: unknown = {};
      if (path === '/api/auth/me') body = { user: { id: 'customer', email: 'test@example.com', name: 'Test', role: 'CUSTOMER', loyaltyPoints: 0 } };
      else if (path === '/api/products/coffee') body = product();
      else if (path === '/api/products') body = [product()];
      else if (path === '/api/products/availability') {
        const items = route.request().postDataJSON().items as { size: string; quantity: number; toppingIds: string[] }[];
        posted.push(items);
        const demand = items.reduce((n, i) => n + i.quantity * ((i.size === 'S' ? 10 : 30) + i.toppingIds.length * 10), 0);
        if (demand > coffee) { status = 409; body = { message: 'Không đủ nguyên vật liệu: Cà phê' }; }
        else body = { valid: true };
      } else if (path === '/api/orders') { status = 409; body = { message: 'Không đủ nguyên vật liệu: Cà phê' }; }
      else body = [];
      await route.fulfill({ status, headers, json: body });
    });
    await page.goto('/products/coffee');
    await expect(page.getByText('Còn 36 phần', { exact: true })).toBeVisible();
    const plus = page.getByRole('button', { name: 'Tăng số lượng' });
    for (let i = 1; i < 20; i++) await plus.click();
    await page.getByRole('button', { name: /Size L/ }).click();
    await expect(page.getByText('Còn 12 phần', { exact: true })).toBeVisible();
    await expect(page.locator('.quantity span')).toHaveText('12');
    await expect(page.getByRole('status')).toContainText('Đã giảm số lượng xuống 12');
    await expect(plus).toBeDisabled();
    for (const code of ['S', 'L', 'S', 'L']) {
      await page.getByRole('button', { name: new RegExp(`Size ${code}`) }).click();
      await expect(page.getByText(`Còn ${code === 'S' ? 36 : 12} phần`, { exact: true })).toBeVisible();
    }
    await page.getByRole('button', { name: 'Giảm số lượng' }).click();
    await expect(plus).toBeEnabled();
    await plus.click();
    await page.getByRole('button', { name: /Size M/ }).click();
    await expect(page.getByText('Hết hàng', { exact: true })).toBeVisible();
    await expect(plus).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: /Size L/ }).click();
    await expect(page.locator('.quantity span')).toHaveText('1');
    await page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }).click();
    await expect(page).toHaveURL(/\/cart$/);
    await expect(page.locator('.cart-row')).toHaveCount(1);
    expect(posted.some((items) => items.some((i) => i.size === 'L' && i.quantity === 1))).toBeTruthy();
    await expect(page.getByRole('button', { name: /Tiến hành đặt hàng/ })).toBeEnabled();
    await page.screenshot({ path: `test-results/size-cart-${width}.png`, fullPage: true });
    // Checkout must preserve the cart and expose a link that refreshes stock after rejection.
    await page.getByRole('button', { name: /Tiến hành đặt hàng/ }).click();
    await expect(page).toHaveURL(/\/checkout$/);
    await page.getByRole('button', { name: /Đặt hàng|Thanh toán|Xác nhận/ }).last().click();
    await expect(page.locator('main [role=alert]')).toContainText('Không đủ nguyên vật liệu');
    await expect(page.getByRole('link', { name: 'Kiểm tra lại giỏ và tồn khả dụng' })).toBeVisible();
    // Existing L plus 34 S cannot fit 360g, even though each line individually could.
    await page.goto('/products/coffee');
    for (let i = 1; i < 34; i++) await plus.click();
    await page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }).click();
    await expect(page.locator('main [role=alert]')).toContainText('Không đủ nguyên vật liệu');
    await expect(page).toHaveURL(/\/products\/coffee$/);
    largeLimit = 5;
    await page.reload();
    await page.getByRole('button', { name: /Size L/ }).click();
    await expect(page.getByText('Còn 5 phần', { exact: true })).toBeVisible();
    await page.screenshot({ path: `test-results/size-detail-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    coffee = 0;
    await page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }).click();
    await expect(page.getByText('Hết hàng', { exact: true })).toBeVisible();
    await expect(plus).toBeDisabled();
  });
}

test('missing availability and failed loading never fall back to common stock', async ({ page }) => {
  let failure = false;
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/products/coffee') {
      await new Promise((resolve) => setTimeout(resolve, 250));
      return route.fulfill({ status: failure ? 503 : 200, json: failure ? { message: 'Không thể tải kho' } : {
        id: 'coffee', name: 'Cà phê', stock: 999, price: 30000, imageUrl: '', description: '',
        sizes: [{ id: 's', code: 'S', name: 'Nhỏ', extraPrice: 0, available: true }], defaultSizeId: 's', toppings: [],
      } });
    }
    return route.fulfill({ status: path === '/api/auth/me' ? 401 : 200, json: [] });
  });
  await page.goto('/products/coffee');
  await expect(page.getByText('Chưa tải được tồn khả dụng')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true })).toBeDisabled();
  await expect(page.getByText('Còn 999 phần')).toHaveCount(0);
  await expect(page.getByText('Hết hàng', { exact: true })).toHaveCount(0);
  failure = true;
  await page.reload();
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.locator('main [role=alert]')).toContainText('Không thể tải kho');
});
