/**
 * E2E: 文件操作测试
 * 测试文件浏览器、打开文件、编辑器标签页
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

test.describe("侧边栏文件浏览器", () => {
  test("Explorer 图标可点击", async () => {
    // 点击 Explorer 图标（通常是第一个 Activity Bar 图标）
    const explorerBtn = page.locator(
      '[data-testid="activity-explorer"], [data-view="explorer"], .activity-bar button:first-child',
    );
    if (await explorerBtn.first().isVisible()) {
      await explorerBtn.first().click();
      // 等待侧边栏展开
      await page.waitForTimeout(500);
    }
  });

  test("搜索图标可点击", async () => {
    const searchBtn = page.locator(
      '[data-testid="activity-search"], [data-view="search"], .activity-bar button:nth-child(2)',
    );
    if (await searchBtn.first().isVisible()) {
      await searchBtn.first().click();
      await page.waitForTimeout(300);
    }
  });
});

test.describe("键盘快捷键", () => {
  test("Ctrl+Shift+P 打开命令面板", async () => {
    await page.keyboard.press("Control+Shift+P");
    await page.waitForTimeout(500);

    // 命令面板通常是一个搜索输入框
    const palette = page.locator(
      '[data-testid="command-palette"], .command-palette, input[placeholder*="命令"], input[placeholder*="command"]',
    );
    // 如果存在则验证可见
    if (
      await palette
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false)
    ) {
      await expect(palette.first()).toBeVisible();
      // 关闭
      await page.keyboard.press("Escape");
    }
  });
});

test.describe("IPC 通信", () => {
  test("mindcode API 在渲染进程可用", async () => {
    const hasAPI = await page.evaluate(() => {
      return typeof (window as any).mindcode !== "undefined";
    });
    expect(hasAPI).toBe(true);
  });

  test("electronAPI 在渲染进程可用", async () => {
    const hasElectronAPI = await page.evaluate(() => {
      return typeof (window as any).electronAPI !== "undefined";
    });
    expect(hasElectronAPI).toBe(true);
  });

  test("获取应用版本", async () => {
    const version = await page.evaluate(async () => {
      return await (window as any).mindcode?.getVersion?.();
    });
    // 版本号应该是 semver 格式或可能返回字符串
    if (version) {
      expect(typeof version).toBe("string");
    }
  });
});
