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
    const explorerBtn = page.getByTestId("activity-explorer");
    await expect(explorerBtn).toBeVisible();
    await explorerBtn.click();
  });

  test("搜索图标可点击", async () => {
    const searchBtn = page.getByTestId("activity-search");
    await expect(searchBtn).toBeVisible();
    await searchBtn.click();
  });
});

test.describe("键盘快捷键", () => {
  test("Ctrl+Shift+P 打开命令面板", async () => {
    await page.keyboard.press("Control+Shift+P");
    const palette = page.getByTestId("command-palette");
    await expect(palette).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(palette).toHaveCount(0);
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
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });
});
