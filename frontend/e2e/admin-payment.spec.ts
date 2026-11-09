import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

test('checkout marks VNPAY as maintenance and defaults to Admin approval without overflow', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'customer-1',
          email: 'customer@example.test',
          name: 'Khách kiểm thử',
          role: 'CUSTOMER',
          loyaltyPoints: 0,
        },
      },
    }),
  );
  await page.addInitScript(() => {
    localStorage.setItem(
      'brewlite-cart-v1',
      JSON.stringify({
        state: {
          items: [
            {
              key: 'coffee|M||70% đá|50% ít ngọt|',
              productId: 'coffee',
              name: 'Cà phê sữa đá Sài Gòn',
              imageUrl: '/coffee.svg',
              size: 'M',
              toppingIds: [],
              toppingNames: [],
              unitPrice: 45000,
              quantity: 1,
              ice: '70% đá',
              sugar: '50% ít ngọt',
            },
          ],
          promoCode: '',
        },
        version: 2,
      }),
    );
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/checkout');
    await expect(page.getByRole('radio', { name: /VNPAY-QR/ })).toBeDisabled();
    await expect(page.getByText('Đang bảo trì')).toBeVisible();
    await expect(
      page.getByRole('radio', { name: /^Thanh toán qua Admin/ }),
    ).toBeChecked();
    await expect(page.getByRole('button', { name: /Gửi Admin duyệt/ })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('Admin can review the queue at desktop, tablet and mobile widths', async ({ page }) => {
  await page.route('**/api/auth/admin/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'admin-1',
          email: 'admin@example.test',
          name: 'Quản trị viên',
          role: 'ADMIN',
          loyaltyPoints: 0,
        },
      },
    }),
  );
  await page.route('**/api/admin/payments**', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({
        json: {
          id: 'payment-1',
          orderId: 'order-1',
          method: 'ADMIN_APPROVAL',
          status: 'PAID',
          idempotencyKey: 'key-1',
        },
      });
      return;
    }
    await route.fulfill({
      json: [
        {
          id: 'payment-1',
          orderId: '21a650c7-8597-4a01-a8e2-000000000001',
          amount: 135200,
          method: 'ADMIN_APPROVAL',
          status: 'PROCESSING',
          customer: { name: 'Nguyễn Văn An', email: 'an@example.test' },
          orderStatus: 'PENDING',
          createdAt: '2026-11-09T08:00:00.000Z',
        },
      ],
    });
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/admin/payments');
    await expect(
      page.getByRole('heading', { name: 'Quản lý yêu cầu thanh toán' }),
    ).toBeVisible();
    await expect(page.getByText('Nguyễn Văn An')).toBeVisible();
    const requestCard = page.getByRole('article');
    await expect(
      requestCard.getByRole('button', { name: 'Thành công' }),
    ).toBeVisible();
    await expect(
      requestCard.getByRole('button', { name: 'Thất bại' }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test('a stale failed poll cannot overwrite a newer successful Admin refresh', async ({ page }) => {
  await page.route('**/api/auth/admin/me', (route) =>
    route.fulfill({
      json: {
        user: {
          id: 'admin-1',
          email: 'admin@example.test',
          name: 'Quản trị viên',
          role: 'ADMIN',
          loyaltyPoints: 0,
        },
      },
    }),
  );
  let queueCalls = 0;
  await page.route('**/api/admin/payments**', async (route) => {
    queueCalls += 1;
    if (queueCalls === 2) {
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fulfill({
        status: 403,
        json: { message: 'Bạn không có quyền truy cập trang này' },
      });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.goto('/admin/payments');
  await expect(page.getByText('Không có yêu cầu phù hợp')).toBeVisible();
  await page.waitForTimeout(5100);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await page.waitForTimeout(1100);

  await expect(
    page.getByText('Bạn không có quyền truy cập trang này'),
  ).toHaveCount(0);
  await expect(page.getByText('Không có yêu cầu phù hợp')).toBeVisible();
});
