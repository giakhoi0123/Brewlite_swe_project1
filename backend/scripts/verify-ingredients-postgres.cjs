// Isolated PostgreSQL verification; never migrate/seed the application's database.
const { randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: resolve(__dirname, '../../.env'), quiet: true });

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const databaseName = `brewlite_ingredients_test_${randomUUID().replaceAll('-', '')}`;
  if (!/^brewlite_ingredients_test_[a-f0-9]{32}$/.test(databaseName)) throw new Error('Invalid test database name');
  const admin = new PrismaClient();
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${databaseName}`;
  url.searchParams.set('schema', 'public');
  const env = { ...process.env, DATABASE_URL: url.toString(), ORDERS_TEST_DATABASE_URL: url.toString(), PAYMENTS_TEST_DATABASE_URL: url.toString() };
  let created = false;
  try {
    await admin.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    console.log(`Created isolated database: ${databaseName}`);
    for (const args of [
      ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
      ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', '--config', 'jest.config.ts', '--runInBand'],
    ]) {
      const result = spawnSync(process.execPath, args, { cwd: resolve(__dirname, '..'), env, stdio: 'inherit' });
      if (result.error || result.status !== 0) throw new Error(`Verification command failed (exit ${result.status})`);
    }
  } finally {
    try {
      if (created) {
        await admin.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
        console.log(`Removed isolated database: ${databaseName}`);
      }
    } finally { await admin.$disconnect(); }
  }
}
main().catch((error) => { console.error(error.code || error.message); process.exitCode = 1; });
