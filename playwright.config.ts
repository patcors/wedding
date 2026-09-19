import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'garden.spec.ts',
  timeout: 45_000,
  expect: { timeout: 20_000 },
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4399',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'pnpm build && pnpm preview --host 127.0.0.1 --port 4399',
    url: 'http://127.0.0.1:4399/garden/',
    reuseExistingServer: false,
  },
});
