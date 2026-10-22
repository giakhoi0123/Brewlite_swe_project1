// Run against the local Compose PostgreSQL server. Each run owns a fresh database.
// DATABASE_URL is inherited from Compose; credentials are never printed.
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const databaseName = `brewlite_orders_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^brewlite_orders_test_[a-f0-9]{32}$/.test(databaseName)) {
    throw new Error('Invalid test database name');
  }
  const admin = new PrismaClient();
  const testUrl = new URL(process.env.DATABASE_URL);
  testUrl.pathname = `/${databaseName}`;
  testUrl.searchParams.set('schema', 'public');
  const env = {
    ...process.env,
    DATABASE_URL: testUrl.toString(),
    ORDERS_TEST_DATABASE_URL: testUrl.toString(),
    PAYMENTS_TEST_DATABASE_URL: testUrl.toString(),
  };
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    console.log(`Created isolated test database: ${databaseName}`);
    for (const args of [
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand'],
    ]) {
      const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
      if (result.error || result.status !== 0) {
        throw new Error(`Verification command failed (exit ${result.status})`);
      }
    }
  } finally {
    try {
      if (created) {
        // Exact UUID name created by this process only; never target the application DB.
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
