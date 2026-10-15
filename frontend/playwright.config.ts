import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  timeout: 90000,
  expect: { timeout: 12000 },
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: process.env.BREWLITE_E2E_BASE_URL || 'http://localhost:3000', ...devices['Desktop Chrome'], trace: 'retain-on-failure' },
});
