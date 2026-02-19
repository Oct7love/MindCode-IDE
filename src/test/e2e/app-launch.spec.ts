/**
 * E2E: 应用启动与窗口基础测试
 */

import { test, expect, type ElectronApplication, type Page } from "@playwright/test";
import { launchApp, closeApp } from "./helpers";

let app: ElectronApplication;
let page: Page;

test.beforeAll(async () => {
  ({ app, page } = await launchApp());
});

test.afterAll(async () => {
  await closeApp(app);
});

test.describe("应用启动", () => {
  test("窗口成功创建", async () => {
    expect(app).toBeTruthy();
    expect(page).toBeTruthy();
  });

  test("窗口尺寸不小于最小值", async () => {
    const { width, height } = page.viewportSize() ?? { width: 0, height: 0 };
    expect(width).toBeGreaterThanOrEqual(800);
    expect(height).toBeGreaterThanOrEqual(600);
  });

  test("应用标题包含 MindCode", async () => {
    const title = await page.title();
    expect(title.toLowerCase()).toContain("mindcode");
  });

  test("页面无 JavaScript 错误", async () => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    // 等一小段时间收集错误
    await page.waitForTimeout(2000);
    expect(errors).toHaveLength(0);
  });
});

test.describe("主窗口布局", () => {
  test("包含 Activity Bar", async () => {
    // Activity Bar 是最左侧的图标栏
    const activityBar = page.locator('[data-testid="activity-bar"], .activity-bar');
    await expect(activityBar.first()).toBeVisible({ timeout: 10000 });
  });

  test("包含编辑器区域", async () => {
    const editor = page.locator(
      '[data-testid="editor-area"], .editor-area, .monaco-editor, .welcome-page',
    );
    await expect(editor.first()).toBeVisible({ timeout: 10000 });
  });

  test("包含状态栏", async () => {
    const statusBar = page.locator('[data-testid="status-bar"], .status-bar, footer');
    await expect(statusBar.first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe("窗口控制", () => {
  test("窗口可调整大小", async () => {
    const window = await app.browserWindow(page);
    const [origWidth, origHeight] = await window.evaluate((w) => w.getSize());

    await window.evaluate((w) => w.setSize(1000, 700));
    const [newWidth, newHeight] = await window.evaluate((w) => w.getSize());
    expect(newWidth).toBe(1000);
    expect(newHeight).toBe(700);

    // 还原
    await window.evaluate((w, args) => w.setSize(args[0], args[1]), [origWidth, origHeight]);
  });
});
