import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { apiProducts, apiOrders, apiPayments, apiBarista, apiLoyalty } from './api';
import { authService } from './auth';
import { ApiError } from './http';
import type { CartItem } from '../types/domain';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const item: CartItem = {
  key: 'local-key', productId: 'product', name: 'Untrusted name', imageUrl: '/local.svg',
  size: 'M', toppingIds: ['topping'], toppingNames: ['Untrusted topping'], unitPrice: 1,
  quantity: 2, ice: '70% đá', sugar: '50% ít ngọt', note: 'Ít nóng',
};

test('product adapter preserves size UUID/stock/default and posts the entire cart without prices', async () => {
  const sizes = [
    { id: 'small', code: 'S', stock: 36, available: true, name: 'Nhỏ', extraPrice: 0 },
    { id: 'large', code: 'L', stock: 12, available: true, name: 'Lớn', extraPrice: 9000 },
  ];
  globalThis.fetch = async (_url, init) => {
    assert.equal(init?.cache, 'no-store');
    return Response.json({ id: 'coffee', stock: 36, sizes, defaultSizeId: 'large', toppings: [] });
  };
  const p = await apiProducts.get('coffee');
  assert.deepEqual(p?.sizes, sizes.map((s) => ({ ...s, isDefault: s.id === 'large' })));
  globalThis.fetch = async (url, init) => {
    assert.ok(String(url).endsWith('/products/availability'));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.items.length, 2);
    assert.equal(body.items[1].size, 'L');
    assert.equal(body.items[1].quantity, 12);
    assert.equal(body.items[0].unitPrice, undefined);
    return Response.json({ message: 'Không đủ nguyên vật liệu' }, { status: 409 });
  };
  await assert.rejects(apiProducts.validateCart([item, { ...item, size: 'L', quantity: 12 }]), /Không đủ/);
});

test('orders adapter posts options and cookie credentials, never client price/owner/discount', async () => {
  let call: { url: string; init?: RequestInit } | undefined;
  const order = { id: 'server-order', status: 'PENDING', total: 80000 };
  globalThis.fetch = async (url, init) => {
    call = { url: String(url), init };
    return Response.json(order, { status: 201 });
  };
  assert.deepEqual(await apiOrders.create('untrusted-owner', [item], { code: 'SERVER_CODE', discount: 999999 }), order);
  assert.ok(call);
  assert.ok(call.url.endsWith('/orders'));
  assert.equal(call.init?.credentials, 'include');
  assert.equal(call.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(call.init?.body)), {
    items: [{ productId: 'product', size: 'M', toppingIds: ['topping'], quantity: 2, ice: '70% đá', sugar: '50% ít ngọt', note: 'Ít nóng' }],
    promotionCode: 'SERVER_CODE',
  });
});

test('stock conflict remains an API error with a clear message and leaves the cart input intact', async () => {
  const items = [structuredClone(item)];
  globalThis.fetch = async () => Response.json({ message: 'Không đủ tồn kho' }, { status: 409 });
  await assert.rejects(apiOrders.create('user', items), (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.status, 409);
    assert.equal(error.message, 'Không đủ tồn kho');
    return true;
  });
  assert.deepEqual(items, [item]);
});

test('validation messages are shown together; network errors do not fall back to demo orders', async () => {
  globalThis.fetch = async () => Response.json({ message: ['quantity must be positive', 'size is invalid'] }, { status: 400 });
  await assert.rejects(apiOrders.create('user', [item]), /quantity must be positive, size is invalid/);
  globalThis.fetch = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(apiOrders.create('user', [item]), /Network unavailable/);
});

test('history, detail, status and staff requests retain authentication and expected routes', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return Response.json([]); };
  await apiOrders.mine('ignored');
  await apiOrders.get('order/id');
  await apiOrders.status('order/id');
  await apiBarista.list();
  await apiBarista.transition('order/id', 'PREPARING');
  const paths = ['/orders/me', '/orders/order%2Fid', '/orders/order%2Fid/status', '/staff/orders', '/staff/orders/order%2Fid/status'];
  calls.forEach((call, index) => {
    assert.ok(call.url.endsWith(paths[index]));
    assert.equal(call.init?.credentials, 'include');
  });
  assert.equal(calls[4].init?.method, 'PATCH');
  assert.equal(calls[1].init?.cache, 'no-store');
  assert.equal(calls[2].init?.cache, 'no-store');
  assert.deepEqual(JSON.parse(String(calls[4].init?.body)), { status: 'PREPARING' });
});

test('status adapter unwraps the JSON status response', async () => {
  globalThis.fetch = async () => Response.json({ status: 'PENDING' });
  assert.equal(await apiOrders.status('order'), 'PENDING');
});

test('payments adapter sends only the VNPAY initiation contract', async () => {
  let body: unknown;
  let headers: HeadersInit | undefined;
  globalThis.fetch = async (_url, init) => {
    body = JSON.parse(String(init?.body));
    headers = init?.headers;
    return Response.json({
      status: 'PROCESSING',
      paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
    }, { status: 201 });
  };
  await apiPayments.pay(
    'order-id',
    'VNPAY_QR',
    '41a650c7-8597-4a01-a8e2-000000000001',
  );
  assert.deepEqual(body, {
    orderId: 'order-id',
    method: 'VNPAY_QR',
    idempotencyKey: '41a650c7-8597-4a01-a8e2-000000000001',
  });
  assert.deepEqual(headers, {
    'Content-Type': 'application/json',
    'Idempotency-Key': '41a650c7-8597-4a01-a8e2-000000000001',
  });
});

test('payments reconciliation is an authenticated POST scoped to the order', async () => {
  let call: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (url, init) => {
    call = { url: String(url), init };
    return Response.json({ status: 'PAID' });
  };
  await apiPayments.reconcile('order/id');
  assert.ok(call);
  assert.ok(call.url.endsWith('/payments/order%2Fid/reconcile'));
  assert.equal(call.init?.method, 'POST');
  assert.equal(call.init?.credentials, 'include');
  assert.equal(call.init?.body, undefined);
});

test('authService endpoints send correct payload and options', async () => {
  const calls: { url: string; method?: string; body?: unknown }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    return Response.json({ message: 'ok' });
  };

  await authService.forgotPassword('user@example.com');
  await authService.resetPassword('tok123', 'newPass123!');
  await authService.changePassword('oldPass123!', 'newPass123!');

  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.endsWith('/auth/forgot-password'));
  assert.deepEqual(calls[0].body, { email: 'user@example.com' });

  assert.ok(calls[1].url.endsWith('/auth/reset-password'));
  assert.deepEqual(calls[1].body, { token: 'tok123', newPassword: 'newPass123!' });

  assert.ok(calls[2].url.endsWith('/auth/change-password'));
  assert.deepEqual(calls[2].body, { oldPassword: 'oldPass123!', newPassword: 'newPass123!' });
});

test('apiOrders.cancel sends POST to cancel endpoint with reason', async () => {
  let call: { url: string; init?: RequestInit } | undefined;
  globalThis.fetch = async (url, init) => {
    call = { url: String(url), init };
    return Response.json({ id: 'order-1', status: 'CANCELLED' });
  };

  const res = await apiOrders.cancel!('order-1', 'Khách đổi ý');
  assert.ok(call);
  assert.ok(call.url.endsWith('/orders/order-1/cancel'));
  assert.equal(call.init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(call.init?.body)), { reason: 'Khách đổi ý' });
  assert.equal(res.status, 'CANCELLED');
});

test('apiLoyalty.vouchers and redeem call expected endpoints without client-set discount', async () => {
  const calls: { url: string; method?: string; body?: unknown }[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push({
      url: String(url),
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (String(url).endsWith('/loyalty/vouchers')) {
      return Response.json([{ code: 'BL-VOUCHER', discountAmount: 20000, status: 'AVAILABLE' }]);
    }
    return Response.json({ success: true, code: 'BL-VOUCHER-NEW', remainingPoints: 50 });
  };

  const vouchers = await apiLoyalty.vouchers!();
  assert.equal(vouchers.length, 1);
  assert.equal(vouchers[0].discountAmount, 20000);

  const redeemed = await apiLoyalty.redeem!('user-1', { id: 'rw-20k' });
  assert.equal(redeemed.code, 'BL-VOUCHER-NEW');

  assert.ok(calls[0].url.endsWith('/loyalty/vouchers'));
  assert.ok(calls[1].url.endsWith('/loyalty/redeem'));
  assert.deepEqual(calls[1].body, { rewardId: 'rw-20k' }); // Client only sends rewardId!
});
