/**
 * E2E 测试辅助工具
 * 封装 Electron 应用启动、等待、常用断言
 */

import { _electron as electron, type ElectronApplication, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

/** 启动 MindCode Electron 应用（需先 npm run build） */
export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  const mainEntry = path.join(__dirname, "../../../dist/main/main/index.js");
  if (!fs.existsSync(mainEntry)) {
    throw new Error(`构建产物不存在: ${mainEntry}\n请先执行 npm run build`);
  }

  const app = await electron.launch({
    args: [mainEntry],
    env: {
      ...process.env,
      NODE_ENV: "production",
      E2E_TEST: "true",
    },
  });

  // 等待第一个 BrowserWindow 创建
  const page = await app.firstWindow();

  // 等待页面加载完成
  await page.waitForLoadState("domcontentloaded");

  return { app, page };
}

/** 安全关闭应用 */
export async function closeApp(app: ElectronApplication): Promise<void> {
  try {
    await app.close();
  } catch {
    // 忽略关闭时的错误
  }
}

/** 等待元素可见 */
export async function waitForVisible(page: Page, selector: string, timeout = 10000): Promise<void> {
  await page.waitForSelector(selector, { state: "visible", timeout });
}
