// Each invocation owns a fresh DB; never reset/truncate the supplied application DB.
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const databaseName = `brewlite_payments_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^brewlite_payments_test_[a-f0-9]{32}$/.test(databaseName))
    throw new Error('Invalid test database name');
  const admin = new PrismaClient();
  const testUrl = new URL(process.env.DATABASE_URL);
  testUrl.pathname = `/${databaseName}`;
  testUrl.searchParams.set('schema', 'public');
  const env = {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
    ORDERS_TEST_DATABASE_URL: testUrl.toString(),
  };
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    console.log(`Created isolated test database: ${databaseName}`);
    for (const args of [
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      [
        '--experimental-vm-modules',
        'node_modules/jest/bin/jest.js',
        '--runInBand',
        '--runTestsByPath',
        'src/payments/payment-consistency.postgres.spec.ts',
        'src/payments/payment-migration.postgres.spec.ts',
        'src/payments/payment-status.postgres.spec.ts',
        'src/payments/payments.service.spec.ts',
        'src/payments/payments.http.spec.ts',
        'src/orders/order-state-machine.spec.ts',
        'src/inventory/inventory.service.spec.ts',
      ],
    ]) {
      const result = spawnSync(process.execPath, args, {
        env,
        stdio: 'inherit',
        windowsHide: true,
      });
      if (result.error || result.status !== 0)
        throw new Error(`Verification failed (exit ${result.status})`);
    }
  } finally {
    try {
      if (created) {
        await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
        console.log(`Removed isolated test database: ${databaseName}`);
      }
    } finally {
      await admin.$disconnect();
    }
  }
}
main().catch((error) => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
