// Acceptance runner: isolate all writes in a fresh PostgreSQL database.
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { PrismaClient } = require('@prisma/client');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const name = `brewlite_acceptance_${randomUUID().replaceAll('-', '')}`;
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${name}`;
  url.searchParams.set('schema', 'public');
  const env = {
    ...process.env,
    DATABASE_URL: url.toString(),
    ORDERS_TEST_DATABASE_URL: url.toString(),
    PAYMENTS_TEST_DATABASE_URL: url.toString(),
  };
  const admin = new PrismaClient();
  let created = false;
  let failed = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${name}"`);
    created = true;
    console.log(`Created isolated test database: ${name}`);
    for (const args of [
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--runInBand', '--coverage'],
      ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', './test/jest-e2e.json', '--runInBand'],
    ]) {
      const result = spawnSync(process.execPath, args, { env, stdio: 'inherit' });
      if (result.error || result.status !== 0) {
        failed = true;
        console.error(`Acceptance command failed (exit ${result.status})`);
        if (args[0].includes('prisma')) break;
      }
    }
  } finally {
    try {
      if (created) {
        await admin.$executeRawUnsafe(`DROP DATABASE "${name}"`);
        console.log(`Removed isolated test database: ${name}`);
      }
    } finally {
      await admin.$disconnect();
    }
  }
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error.code || error.message);
  process.exitCode = 1;
});
