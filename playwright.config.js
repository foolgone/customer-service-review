import { defineConfig, devices } from '@playwright/test';

const PORT = 5178;

/**
 * E2E 配置
 * - 用系统已安装的 Edge（Chromium 内核），无需 `playwright install` 下载浏览器；
 *   如需换浏览器：`npx playwright test --project=chromium`（需先安装 Playwright 自带 Chromium）。
 * - webServer 起 Vite dev server，测试结束自动关闭；本地已有服务时复用。
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 900 }
  },
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    // 本地默认用系统已装的 Edge（无需下载浏览器）；CI（Ubuntu 无 Edge）用 Playwright 自带 Chromium
    process.env.CI
      ? { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
      : { name: 'edge', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }
  ]
});
