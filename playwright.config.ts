/**
 * Playwright E2E 测试配置
 * 用于 Electron 应用端到端测试
 */

import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/test/e2e",
  timeout: 30000,
  retries: 1,
  workers: 1, // Electron 测试必须串行
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  outputDir: "test-results",
  reporter: process.env.CI
    ? [["list"], ["github"], ["html", { open: "never", outputFolder: "e2e-report" }]]
    : [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
