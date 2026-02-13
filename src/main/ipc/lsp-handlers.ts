/**
 * LSP IPC Handlers
 *
 * 处理语言服务器的启动/停止、请求/通知转发。
 */
import { ipcMain } from "electron";
import { getLSPManager } from "../lsp-manager";
import type { IPCContext } from "./types";

export function registerLSPHandlers(ctx: IPCContext): void {
  const lspManager = getLSPManager();
  const mainWindow = ctx.getMainWindow;

  ipcMain.handle(
    "lsp:start",
    async (
      _event,
      language: string,
      options?: { command?: string; args?: string[]; rootPath?: string },
    ) => {
      return lspManager.start(language, options);
    },
  );

  ipcMain.handle("lsp:stop", async (_event, language: string) => {
    await lspManager.stop(language);
    return { success: true };
  });

  ipcMain.handle(
    "lsp:request",
    async (_event, language: string, method: string, params: unknown) => {
      try {
        const result = await lspManager.request(language, method, params);
        return { success: true, data: result };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  ipcMain.handle(
    "lsp:notify",
    async (_event, language: string, method: string, params: unknown) => {
      await lspManager.notify(language, method, params);
      return { success: true };
    },
  );

  ipcMain.handle("lsp:status", async (_event, language: string) => {
    return lspManager.getStatus(language);
  });

  ipcMain.handle("lsp:detect", async (_event, language: string) => {
    return lspManager.detect(language);
  });

  // 转发 LSP 通知到渲染进程
  lspManager.on("notification", (language: string, method: string, params: unknown) => {
    mainWindow()?.webContents.send("lsp:notification", { language, method, params });
  });
}
