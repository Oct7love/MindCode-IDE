/**
 * Settings & Dialog IPC Handlers
 *
 * 处理应用设置的读写、对话框显示、主题切换、补全设置等。
 */
import { ipcMain, dialog, app } from "electron";
import * as path from "path";
import * as fs from "fs";
import type { IPCContext } from "./types";

const settingsPath = path.join(app.getPath("userData"), "settings.json");

function loadSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Failed to load settings:", error);
  }
  return {};
}

function saveSettings(settings: Record<string, unknown>): void {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf-8");
  } catch (error) {
    console.error("Failed to save settings:", error);
  }
}

const settingsCache = loadSettings();

/** 获取设置缓存（供其他模块使用） */
export function getSettingsCache(): Record<string, unknown> {
  return settingsCache;
}

export function registerSettingsHandlers(ctx: IPCContext): void {
  const mainWindow = ctx.getMainWindow;

  ipcMain.handle("get-app-version", () => app.getVersion());

  // 设置读写
  ipcMain.handle("settings:get", (_event, key: string) => {
    return settingsCache[key];
  });

  ipcMain.handle("settings:set", (_event, key: string, value: unknown) => {
    settingsCache[key] = value;
    saveSettings(settingsCache);
  });

  // 对话框
  ipcMain.handle(
    "dialog:showSaveDialog",
    async (
      _event,
      options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] },
    ) => {
      const win = mainWindow();
      if (!win) return { canceled: true, filePath: undefined };
      const result = await dialog.showSaveDialog(win, {
        defaultPath: options.defaultPath,
        filters: options.filters || [{ name: "All Files", extensions: ["*"] }],
      });
      return { canceled: result.canceled, filePath: result.filePath };
    },
  );

  ipcMain.handle(
    "dialog:showOpenDialog",
    async (
      _event,
      options: { filters?: { name: string; extensions: string[] }[]; properties?: string[] },
    ) => {
      const win = mainWindow();
      if (!win) return { canceled: true, filePaths: [] };
      const result = await dialog.showOpenDialog(win, {
        filters: options.filters || [{ name: "All Files", extensions: ["*"] }],
        properties: (options.properties as ("openFile" | "openDirectory")[]) || ["openFile"],
      });
      return { canceled: result.canceled, filePaths: result.filePaths };
    },
  );

  ipcMain.handle(
    "dialog:showMessageBox",
    async (
      _event,
      options: { type?: string; title?: string; message: string; buttons?: string[] },
    ) => {
      const win = mainWindow();
      if (!win) return { response: 0 };
      const result = await dialog.showMessageBox(win, {
        type: (options.type as "info" | "warning" | "error" | "question") || "info",
        title: options.title || "MindCode",
        message: options.message,
        buttons: options.buttons || ["OK"],
      });
      return { response: result.response };
    },
  );

  // 主题切换
  ipcMain.on("theme:change", (_event, themeId: string) => {
    mainWindow()?.webContents.send("theme:change", themeId);
  });

  // 补全设置
  ipcMain.handle("ai:completion-settings", async () => {
    const enabled = settingsCache["completion.enabled"] ?? true;
    const model = settingsCache["completion.model"] ?? "codesuc-sonnet";
    const debounceMs = settingsCache["completion.debounceMs"] ?? 150;
    return { enabled, model, debounceMs };
  });

  ipcMain.handle(
    "ai:completion-settings-set",
    async (
      _event,
      settings: {
        enabled?: boolean;
        model?: string;
        debounceMs?: number;
      },
    ) => {
      if (settings.enabled !== undefined) settingsCache["completion.enabled"] = settings.enabled;
      if (settings.model !== undefined) settingsCache["completion.model"] = settings.model;
      if (settings.debounceMs !== undefined)
        settingsCache["completion.debounceMs"] = settings.debounceMs;
      saveSettings(settingsCache);
      return { success: true };
    },
  );
}
