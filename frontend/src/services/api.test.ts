import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { apiOrders, apiBarista } from './api';
import { ApiError } from './http';
import type { CartItem } from '../types/domain';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const item: CartItem = {
  key: 'local-key', productId: 'product', name: 'Untrusted name', imageUrl: '/local.svg',
  size: 'M', toppingIds: ['topping'], toppingNames: ['Untrusted topping'], unitPrice: 1,
  quantity: 2, ice: '70% đá', sugar: '50% ít ngọt', note: 'Ít nóng',
};

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
  assert.deepEqual(JSON.parse(String(calls[4].init?.body)), { status: 'PREPARING' });
});

test('status adapter unwraps the JSON status response', async () => {
  globalThis.fetch = async () => Response.json({ status: 'PENDING' });
  assert.equal(await apiOrders.status('order'), 'PENDING');
});
