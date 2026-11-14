import { expect, test } from '@playwright/test';

const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

test('checkout enables VNPAY by default and keeps Admin approval available without overflow', async ({ page }) => {
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
    const vnpayOption = page.getByRole('radio', { name: /VNPAY-QR/ });
    await expect(vnpayOption).toBeEnabled();
    await expect(vnpayOption).toBeChecked();
    const adminOption = page.getByRole('radio', {
      name: /^Thanh toán qua Admin/,
    });
    await expect(adminOption).toBeEnabled();
    await expect(adminOption).not.toBeChecked();
    await expect(page.getByRole('button', { name: /Thanh toán qua VNPAY/ })).toBeVisible();
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

test('customer cancellation waits for Admin approval with a recorded reason', async ({ page }) => {
  const orderId = '21a650c7-8597-4a01-a8e2-000000000101';
  const paymentId = '31a650c7-8597-4a01-a8e2-000000000101';
  let orderStatus = 'PENDING';
  let paymentStatus = 'PROCESSING';
  let cancelRequestStatus: 'PENDING' | 'APPROVED' | undefined;
  let submittedReason = '';

  const order = () => ({
    id: orderId,
    userId: 'customer-1',
    items: [],
    subtotal: 43000,
    discount: 0,
    total: 43000,
    status: orderStatus,
    createdAt: '2026-11-10T12:34:37.393Z',
    ...(orderStatus === 'CANCELLED'
      ? { cancelReason: submittedReason }
      : {}),
  });
  const payment = () => ({
    id: paymentId,
    orderId,
    method: 'ADMIN_APPROVAL',
    status: paymentStatus,
    idempotencyKey: 'admin-payment-key',
    ...(cancelRequestStatus
      ? {
          cancelRequestStatus,
          cancelRequestReason: submittedReason,
        }
      : {}),
  });

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
  await page.route(`**/api/orders/${orderId}`, (route) =>
    route.fulfill({ json: order() }),
  );
  await page.route(`**/api/payments/order/${orderId}`, (route) =>
    route.fulfill({ json: payment() }),
  );
  await page.route(`**/api/payments/${orderId}/cancel-request`, async (route) => {
    const body = route.request().postDataJSON() as { reason: string };
    submittedReason = body.reason;
    cancelRequestStatus = 'PENDING';
    await route.fulfill({ json: payment() });
  });
  await page.route('**/api/admin/payments**', async (route) => {
    if (route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON() as { decision: string };
      expect(body).toEqual({ decision: 'APPROVE' });
      cancelRequestStatus = 'APPROVED';
      paymentStatus = 'PAYMENT_FAILED';
      orderStatus = 'CANCELLED';
      await route.fulfill({ json: payment() });
      return;
    }
    const processingOnly = new URL(route.request().url()).searchParams.get(
      'status',
    ) === 'PROCESSING';
    await route.fulfill({
      json:
        processingOnly && paymentStatus !== 'PROCESSING'
          ? []
          : [
              {
                ...payment(),
                amount: 43000,
                customer: {
                  name: 'Khách kiểm thử',
                  email: 'customer@example.test',
                },
                orderStatus,
                createdAt: '2026-11-10T12:34:37.393Z',
              },
            ],
    });
  });

  await page.goto(`/payment/${orderId}/pending-admin`);
  await page.getByLabel('Lý do muốn hủy thanh toán').fill('Khách đặt nhầm món');
  await page.getByRole('button', { name: 'Gửi yêu cầu hủy' }).click();
  await expect(page.getByText('Đang chờ Admin duyệt hủy')).toBeVisible();
  await expect(page.getByText('Lý do của bạn: Khách đặt nhầm món')).toBeVisible();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }

  page.on('dialog', (dialog) => dialog.accept());
  await page.goto('/admin/payments');
  await expect(page.getByText('Khách đang yêu cầu hủy')).toBeVisible();
  await expect(page.getByText('Lý do khách: Khách đặt nhầm món')).toBeVisible();
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('button', { name: 'Cho phép hủy' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Từ chối hủy' })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Cho phép hủy' }).click();
  await expect(page.getByText('Không có yêu cầu phù hợp')).toBeVisible();

  await page.goto(`/payment/${orderId}/pending-admin`);
  await expect(page).toHaveURL(new RegExp(`/payment/${orderId}/failure$`));
  await expect(page.getByText(/Admin đã chấp nhận hủy/)).toBeVisible();
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

test('a cancelled VNPAY attempt is reconciled before another method is enabled', async ({ page }) => {
  const orderId = '21a650c7-8597-4a01-a8e2-000000000099';
  let reconciled = false;
  const order = () => ({
    id: orderId,
    userId: 'customer-1',
    items: [
      {
        key: 'coffee|M||70% đá|50% ít ngọt|',
        productId: 'coffee',
        name: 'Cà phê sữa đá',
        imageUrl: '/coffee.svg',
        size: 'M',
        toppingIds: [],
        toppingNames: [],
        unitPrice: 43000,
        quantity: 1,
        ice: '70% đá',
        sugar: '50% ít ngọt',
      },
    ],
    subtotal: 43000,
    discount: 0,
    total: 43000,
    status: reconciled ? 'PAYMENT_FAILED' : 'PENDING',
    createdAt: '2026-11-10T12:34:37.393Z',
  });

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
  await page.route(`**/api/payments/${orderId}/reconcile`, (route) => {
    reconciled = true;
    return route.fulfill({
      json: {
        id: 'payment-1',
        orderId,
        method: 'VNPAY_QR',
        status: 'PAYMENT_FAILED',
        idempotencyKey: 'payment-key',
      },
    });
  });
  await page.route(`**/api/orders/${orderId}`, (route) =>
    route.fulfill({ json: order() }),
  );

  await page.goto(`/payment/${orderId}/unknown`);
  await page.getByRole('button', { name: 'Kiểm tra để đổi phương thức' }).click();
  await expect(page).toHaveURL(
    new RegExp(`/checkout\\?retryOrder=${orderId}$`),
  );
  const vnpayOption = page.getByRole('radio', { name: /VNPAY-QR/ });
  await expect(vnpayOption).toBeEnabled();
  await expect(vnpayOption).toBeChecked();
  const adminOption = page.getByRole('radio', {
    name: /^Thanh toán qua Admin/,
  });
  await expect(adminOption).toBeEnabled();
  await expect(adminOption).not.toBeChecked();
});

test('a resumed VNPAY checkout can reconcile and unlock another method', async ({ page }) => {
  const orderId = '21a650c7-8597-4a01-a8e2-000000000100';
  let reconciled = false;
  const order = () => ({
    id: orderId,
    userId: 'customer-1',
    items: [
      {
        key: 'coffee|M||70% đá|50% ít ngọt|',
        productId: 'coffee',
        name: 'Cà phê sữa đá',
        imageUrl: '/coffee.svg',
        size: 'M',
        toppingIds: [],
        toppingNames: [],
        unitPrice: 43000,
        quantity: 1,
        ice: '70% đá',
        sugar: '50% ít ngọt',
      },
    ],
    subtotal: 43000,
    discount: 0,
    total: 43000,
    status: reconciled ? 'PAYMENT_FAILED' : 'PENDING',
    createdAt: '2026-11-10T12:34:37.393Z',
  });

  await page.addInitScript(
    ({ key, value }) => sessionStorage.setItem(key, value),
    {
      key: `brewlite-payment-${orderId}`,
      value: JSON.stringify({ key: 'old-payment-key', method: 'VNPAY_QR' }),
    },
  );
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
  await page.route(`**/api/payments/${orderId}/reconcile`, (route) => {
    reconciled = true;
    return route.fulfill({
      json: {
        id: 'payment-1',
        orderId,
        method: 'VNPAY_QR',
        status: 'PAYMENT_FAILED',
        idempotencyKey: 'old-payment-key',
      },
    });
  });
  await page.route(`**/api/orders/${orderId}`, (route) =>
    route.fulfill({ json: order() }),
  );

  for (const viewport of viewports) {
    reconciled = false;
    await page.setViewportSize(viewport);
    await page.goto(`/checkout?resumeOrder=${orderId}`);
    await expect(page.getByRole('radio', { name: /VNPAY-QR/ })).toBeDisabled();
    await expect(
      page.getByRole('radio', { name: /^Thanh toán qua Admin/ }),
    ).toBeDisabled();
    await page
      .getByRole('button', { name: 'Kiểm tra để đổi phương thức' })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/checkout\\?retryOrder=${orderId}$`),
    );
    await expect(page.getByRole('radio', { name: /VNPAY-QR/ })).toBeEnabled();
    await expect(page.getByRole('radio', { name: /VNPAY-QR/ })).toBeChecked();
    await expect(
      page.getByRole('radio', { name: /^Thanh toán qua Admin/ }),
    ).toBeEnabled();
    await expect(
      page.getByRole('radio', { name: /^Thanh toán qua Admin/ }),
    ).not.toBeChecked();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBeTruthy();
  }
});
