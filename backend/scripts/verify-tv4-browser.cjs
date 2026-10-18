// Real Auth/Orders/Payments/Staff APIs on a fresh PostgreSQL database.
// Payment gateway is the assignment's mock gateway; no browser route is mocked.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const {
  chromium,
  expect,
} = require('../../frontend/node_modules/@playwright/test');

const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');
const frontend = path.join(root, 'frontend');
require('dotenv').config({ path: path.join(root, '.env'), quiet: true });
const evidence = path.join(root, 'docs/evidence/tv4-acceptance');
const web = 'http://localhost:33220';
const api = 'http://localhost:33221/api';
const children = [];
const results = [];
const summary = {
  startedAt: new Date().toISOString(),
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root })
    .toString()
    .trim(),
  workingTree: execFileSync('git', ['status', '--short'], { cwd: root })
    .toString()
    .trim(),
  dataMode: 'api',
  gateway: 'MockPaymentGateway (server outcome PAID)',
  results,
  passed: false,
};

function saveSummary() {
  fs.writeFileSync(
    path.join(evidence, 'result.json'),
    JSON.stringify(summary, null, 2) + '\n',
  );
}
function start(label, cwd, args, env) {
  const log = fs.createWriteStream(path.join(evidence, `${label}.log`));
  const child = spawn(process.execPath, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Both streams share one file; close it only after the child has closed both.
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.failure = null;
  child.on('error', (error) => {
    child.failure = error;
  });
  child.on('close', () => log.end());
  children.push(child);
  return child;
}
async function run(label, cwd, args, env) {
  console.log(label);
  const child = start(label, cwd, args, env);
  await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${label}: exit ${code}; see ${label}.log`)),
    );
  });
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(port, () => server.close(resolve));
  });
}
async function ready(child, url, expected) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.failure || child.exitCode !== null)
      throw new Error(`Server exited before ${url} was ready`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      if (response.status === expected) return;
    } catch {
      /* Server is still starting. */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Readiness timeout: ${url}`);
}
async function stopChildren() {
  for (const child of [...children].reverse()) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000);
      child.once('close', () => {
        clearTimeout(timer);
        resolve();
      });
      child.kill();
    });
  }
}
async function login(page, email, password, role) {
  // Auth illustration uses a remote URL; wait for the app DOM, not remote images.
  await page.goto(`${web}/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  const response = page.waitForResponse(
    (r) => r.url() === `${api}/auth/login` && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  expect((await response).status()).toBe(201);
  await expect(page).toHaveURL(
    role === 'BARISTA' ? `${web}/barista/dashboard` : `${web}/`,
  );
  const me = await page.request.get(`${api}/auth/me`);
  expect(me.status()).toBe(200);
  expect((await me.json()).user.role).toBe(role);
}
async function responseJson(response, status) {
  const body = await response.json();
  assert.equal(response.status(), status, JSON.stringify(body));
  return body;
}

async function verifyViewport(browser, db, width) {
  console.log(`Checking two real browser sessions at ${width}px`);
  const password = `TV4-${randomUUID()}`;
  const passwordHash = await bcrypt.hash(password, 10);
  const customer = await db.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      fullName: 'Khách TV4',
      passwordHash,
    },
  });
  const staff = await db.user.create({
    data: {
      email: `${randomUUID()}@example.test`,
      fullName: 'Barista TV4',
      passwordHash,
      role: 'BARISTA',
    },
  });
  const topping = await db.topping.create({ data: { name: 'TV4 Kem cheese' } });
  const product = await db.product.create({
    data: {
      name: `TV4 Coffee ${width}`,
      price: 30000,
      stock: 10,
      description: 'Independent-session acceptance fixture',
      imageUrl: '/images/products/sample-milk-coffee.svg',
      sizes: {
        create: [
          { code: 'S', name: 'Nhỏ', extraPrice: 0 },
          { code: 'M', name: 'Vừa', extraPrice: 4000, isDefault: true },
          { code: 'L', name: 'Lớn', extraPrice: 9000 },
        ],
      },
      toppings: { create: { toppingId: topping.id, extraPrice: 6000 } },
    },
  });
  const options = { viewport: { width, height: 1000 } };
  const customerContext = await browser.newContext(options);
  const staffContext = await browser.newContext(options);
  const customerPage = await customerContext.newPage();
  const staffPage = await staffContext.newPage();
  customerPage.setDefaultTimeout(20000);
  staffPage.setDefaultTimeout(20000);
  try {
    await login(customerPage, customer.email, password, 'CUSTOMER');
    await login(staffPage, staff.email, password, 'BARISTA');
    const customerCookie = (await customerContext.cookies(api)).find(
      (c) => c.name === 'brewlite_session',
    );
    const staffCookie = (await staffContext.cookies(api)).find(
      (c) => c.name === 'brewlite_session',
    );
    assert(customerCookie?.httpOnly && staffCookie?.httpOnly);
    assert.notEqual(customerCookie.value, staffCookie.value);
    expect(
      (await customerContext.request.get(`${api}/staff/orders`)).status(),
    ).toBe(403);

    await customerPage.goto(`${web}/products/${product.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      customerPage.getByRole('heading', { name: product.name, exact: true }),
    ).toBeVisible();
    await customerPage.getByRole('button', { name: /Size L/ }).click();
    await customerPage.getByRole('checkbox', { name: topping.name }).check();
    await customerPage
      .getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true })
      .click();
    await expect(customerPage).toHaveURL(`${web}/cart`);
    await customerPage
      .getByRole('button', { name: /Tiến hành đặt hàng/i })
      .click();
    await expect(customerPage).toHaveURL(`${web}/checkout`);
    const created = customerPage.waitForResponse(
      (r) => r.url() === `${api}/orders` && r.request().method() === 'POST',
    );
    const paid = customerPage.waitForResponse(
      (r) => r.url() === `${api}/payments` && r.request().method() === 'POST',
    );
    await customerPage
      .getByRole('button', { name: /Xác nhận thanh toán/ })
      .click();
    const order = await responseJson(await created, 201);
    expect(order).toMatchObject({
      userId: customer.id,
      status: 'PENDING',
      total: 45000,
    });
    await responseJson(await paid, 201);
    await expect(
      customerPage.getByRole('heading', { name: 'Đặt hàng thành công!' }),
    ).toBeVisible();
    expect(
      await db.order.findUniqueOrThrow({ where: { id: order.id } }),
    ).toMatchObject({ status: 'PAID', total: 45000 });
    expect(
      await db.payment.count({ where: { orderId: order.id, status: 'PAID' } }),
    ).toBe(1);

    // A second unpaid order must never enter the PAID preparation queue.
    const pending = await responseJson(
      await customerContext.request.post(`${api}/orders`, {
        headers: { Origin: web },
        data: {
          items: [
            {
              productId: product.id,
              size: 'L',
              toppingIds: [topping.id],
              quantity: 1,
              ice: '70% đá',
              sugar: '50% ít ngọt',
              note: 'TV4 acceptance',
            },
          ],
        },
      }),
      201,
    );
    await staffPage.getByRole('button', { name: /Làm mới/ }).click();
    const ticket = staffPage
      .locator('.barista-ticket')
      .filter({ hasText: `#${order.id}` });
    await expect(ticket).toBeVisible();
    await expect(ticket).toContainText('Size L');
    await expect(ticket).toContainText(topping.name);
    await expect(
      staffPage
        .locator('.barista-ticket')
        .filter({ hasText: `#${pending.id}` }),
    ).toHaveCount(0);
    await staffPage.screenshot({
      path: path.join(evidence, `staff-paid-${width}.png`),
      fullPage: true,
    });
    await customerPage.goto(`${web}/orders/${order.id}`, {
      waitUntil: 'domcontentloaded',
    });
    await expect(customerPage.locator('.status.PAID')).toBeVisible();

    for (const [status, label] of [
      ['PREPARING', 'Bắt đầu pha chế'],
      ['READY', 'Đã pha chế xong'],
      ['COMPLETED', 'Xác nhận đã giao'],
    ]) {
      await ticket.getByRole('button', { name: label, exact: true }).click();
      const dialog = staffPage.getByRole('dialog', {
        name: 'Xác nhận cập nhật đơn',
      });
      await expect(dialog).toBeVisible();
      const updated = staffPage.waitForResponse(
        (r) =>
          r.url() === `${api}/staff/orders/${order.id}/status` &&
          r.request().method() === 'PATCH',
      );
      await dialog
        .getByRole('button', { name: 'Xác nhận', exact: true })
        .click();
      expect(await responseJson(await updated, 200)).toMatchObject({ status });
      await expect(dialog).toHaveCount(0);
      await customerPage
        .getByRole('button', { name: 'Cập nhật trạng thái' })
        .click();
      await expect(customerPage.locator(`.status.${status}`)).toBeVisible();
    }
    const stored = await db.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { statusHistory: { orderBy: { version: 'asc' } } },
    });
    assert(stored.completedAt instanceof Date);
    expect(stored.statusHistory.map((h) => h.toStatus)).toEqual([
      'PENDING',
      'PAID',
      'PREPARING',
      'READY',
      'COMPLETED',
    ]);
    expect(stored.completedAt.toISOString()).toBe(
      stored.statusHistory[4].createdAt.toISOString(),
    );
    await customerPage.screenshot({
      path: path.join(evidence, `customer-completed-${width}.png`),
      fullPage: true,
    });

    // Cancellation/history UI remains TV1's integration task; exercise the real backend contract here.
    const cancel = (data) =>
      staffContext.request.patch(`${api}/staff/orders/${pending.id}/cancel`, {
        headers: { Origin: web },
        data,
      });
    expect((await cancel({ reason: '   ' })).status()).toBe(400);
    const reason = 'Khách yêu cầu hủy trước khi pha';
    expect(await responseJson(await cancel({ reason }), 200)).toMatchObject({
      status: 'CANCELLED',
      cancelReason: reason,
    });
    expect((await cancel({ reason })).status()).toBe(409);
    expect(
      (
        await staffContext.request.patch(
          `${api}/staff/orders/${order.id}/cancel`,
          { headers: { Origin: web }, data: { reason } },
        )
      ).status(),
    ).toBe(409);
    const detail = await responseJson(
      await staffContext.request.get(`${api}/staff/orders/${order.id}`),
      200,
    );
    expect(detail).toMatchObject({
      status: 'COMPLETED',
      completedAt: stored.completedAt.toISOString(),
    });
    const list = await responseJson(
      await staffContext.request.get(`${api}/staff/orders`),
      200,
    );
    expect(list.find((row) => row.id === order.id)).toMatchObject({
      status: 'COMPLETED',
    });
    expect(list.find((row) => row.id === pending.id)).toMatchObject({
      status: 'CANCELLED',
      cancelReason: reason,
    });
    expect(
      await responseJson(
        await customerContext.request.get(`${api}/orders/${pending.id}`),
        200,
      ),
    ).toMatchObject({ status: 'CANCELLED', cancelReason: reason });
    expect(
      await db.product.findUniqueOrThrow({ where: { id: product.id } }),
    ).toMatchObject({ stock: 9 });
    results.push({
      width,
      passed: true,
      orderId: order.id,
      cancelledOrderId: pending.id,
      checks: [
        'Two real logins with distinct HttpOnly sessions; CUSTOMER staff-list 403',
        'UI checkout -> PENDING -> real Payment API PAID (mock gateway)',
        'PAID queue/configuration; unpaid order excluded',
        'UI-confirmed PAID -> PREPARING -> READY -> COMPLETED; customer refresh each step',
        'Single persisted completedAt matches final history event',
        'API: empty cancel reason 400; reason persisted; repeated/terminal cancel 409',
        'API: terminal history and staff detail; customer sees same cancelReason',
        'Cancelled reservation restored once; completed stock remains consumed',
      ],
    });
    saveSummary();
  } catch (error) {
    for (const [name, page] of [
      ['customer', customerPage],
      ['staff', staffPage],
    ]) {
      await page
        .screenshot({
          path: path.join(evidence, `failure-${name}-${width}.png`),
          fullPage: true,
        })
        .catch(() => {});
    }
    throw error;
  } finally {
    await customerContext.close();
    await staffContext.close();
  }
}

async function main() {
  if (!process.env.DATABASE_URL)
    throw new Error('Set DATABASE_URL for the local PostgreSQL server');
  await freePort(33220);
  await freePort(33221);
  fs.mkdirSync(evidence, { recursive: true });
  saveSummary();
  const name = `brewlite_tv4_browser_test_${randomUUID().replaceAll('-', '')}`;
  assert(/^brewlite_tv4_browser_test_[a-f0-9]{32}$/.test(name));
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    FRONTEND_ORIGIN: web,
    JWT_SECRET: randomUUID(),
    PORT: '33221',
    NODE_ENV: 'test',
    MOCK_PAYMENT_OUTCOME: 'PAID',
    PAYMENT_DEMO_CONTROLS: 'false',
    NEXT_PUBLIC_DATA_MODE: 'api',
    NEXT_PUBLIC_API_URL: api,
    NEXT_PUBLIC_PAYMENT_DEMO_CONTROLS: 'false',
    NEXT_TELEMETRY_DISABLED: '1',
  };
  const admin = new PrismaClient();
  const db = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  let created = false;
  let browser;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    created = true;
    await run(
      'migrations',
      backend,
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      env,
    );
    await run(
      'backend-build',
      backend,
      ['node_modules/@nestjs/cli/bin/nest.js', 'build'],
      env,
    );
    await run(
      'frontend-build',
      frontend,
      ['node_modules/next/dist/bin/next', 'build', '--webpack'],
      { ...env, NODE_ENV: 'production' },
    );
    const apiServer = start('backend-server', backend, ['dist/main.js'], env);
    const webServer = start(
      'frontend-server',
      frontend,
      ['node_modules/next/dist/bin/next', 'start', '--port', '33220'],
      { ...env, NODE_ENV: 'production' },
    );
    await ready(apiServer, `${api}/auth/me`, 401);
    await ready(webServer, `${web}/login`, 200);
    browser = await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge',
      headless: true,
    });
    summary.browser = await browser.version();
    for (const width of [1440, 768, 390])
      await verifyViewport(browser, db, width);
    summary.passed = true;
    console.log('PASS: TV4 real-API acceptance at 1440/768/390');
  } finally {
    if (browser) await browser.close();
    await stopChildren();
    await db.$disconnect();
    try {
      if (created) {
        await admin.$executeRawUnsafe(`DROP DATABASE "${name}" WITH (FORCE)`);
        summary.isolatedDatabaseRemoved = true;
      }
    } finally {
      await admin.$disconnect();
      summary.finishedAt = new Date().toISOString();
      saveSummary();
    }
  }
}
main().catch((error) => {
  summary.passed = false;
  // Never write database credentials, passwords or cookies to evidence.
  summary.failure = String(error.message).replaceAll(
    process.env.DATABASE_URL || 'no-database-url',
    '[DATABASE_URL]',
  );
  if (fs.existsSync(evidence)) saveSummary();
  console.error(summary.failure);
  process.exitCode = 1;
});
