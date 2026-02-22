/**
 * MindCode Main Process Entry Point
 *
 * Electron 主进程入口。负责：
 * - 创建应用窗口
 * - 注册应用菜单
 * - 注册所有 IPC 处理器（模块化）
 * - 启动性能追踪
 */

// 在所有模块加载前注入环境变量
import { config as loadDotenv } from "dotenv";
import * as _path from "path";
loadDotenv({ path: _path.resolve(__dirname, "../../../.env") });

import type { MenuItemConstructorOptions } from "electron";
import { app, BrowserWindow, ipcMain, dialog, Menu, session } from "electron";
import * as path from "path";
import { markStartup } from "../core/performance";
import {
  registerFSHandlers,
  registerAIHandlers,
  registerGitHandlers,
  registerTerminalHandlers,
  registerSettingsHandlers,
  registerDebugHandlers,
  registerLSPHandlers,
  registerIndexHandlers,
  registerDashboardHandlers,
  registerPluginHandlers,
  warmupAIProviders,
  type IPCContext,
} from "./ipc";
import { initLogging } from "./log-setup";

markStartup("main_start");

let mainWindow: BrowserWindow | null = null;

const isDev = process.argv.includes("--dev") || process.env.NODE_ENV === "development";

/** 开发模式下的加载重试配置 */
const DEV_SERVER_URL = "http://localhost:5173";
const MAX_LOAD_RETRIES = 10;
const RETRY_BASE_DELAY_MS = 500;
const RETRY_MAX_DELAY_MS = 3000;

/** 窗口默认尺寸 */
const DEFAULT_WINDOW_WIDTH = 1400;
const DEFAULT_WINDOW_HEIGHT = 900;
const MIN_WINDOW_WIDTH = 800;
const MIN_WINDOW_HEIGHT = 600;

// ==================== IPC Context ====================
let _workspacePath: string | null = null;
const ipcContext: IPCContext = {
  getMainWindow: () => mainWindow,
  isDev,
  getWorkspacePath: () => _workspacePath,
  setWorkspacePath: (p) => {
    _workspacePath = p;
  },
};

// ==================== Window Management ====================
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: DEFAULT_WINDOW_WIDTH,
    height: DEFAULT_WINDOW_HEIGHT,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    title: "MindCode",
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    frame: false,
    titleBarStyle: "hidden",
    backgroundColor: "#1e1e1e",
  });

  if (isDev) {
    mainWindow.loadURL(DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../../renderer/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // 开发模式下自动重试加载
  let retryCount = 0;
  mainWindow.webContents.on("did-fail-load", () => {
    if (isDev && retryCount < MAX_LOAD_RETRIES) {
      retryCount++;
      const delay = Math.min(RETRY_BASE_DELAY_MS * retryCount, RETRY_MAX_DELAY_MS);
      setTimeout(() => mainWindow?.loadURL(DEV_SERVER_URL), delay);
    }
  });
}

// ==================== Window Control IPC ====================
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());
ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized() ?? false);
ipcMain.on("window:showMenu", (_event, x: number, y: number) => {
  const menu = Menu.getApplicationMenu();
  if (menu && mainWindow) menu.popup({ window: mainWindow, x: Math.round(x), y: Math.round(y) });
});

// ==================== Application Menu ====================
function createMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { label: "New Window", accelerator: "CmdOrCtrl+Shift+N", click: () => createWindow() },
        {
          label: "New File",
          accelerator: "CmdOrCtrl+N",
          click: () => mainWindow?.webContents.send("menu:newFile"),
        },
        { type: "separator" },
        {
          label: "Open File...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ["openFile"],
              filters: [
                { name: "All Files", extensions: ["*"] },
                { name: "TypeScript", extensions: ["ts", "tsx"] },
                { name: "JavaScript", extensions: ["js", "jsx"] },
                { name: "JSON", extensions: ["json"] },
              ],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send("menu:openFile", result.filePaths[0]);
            }
          },
        },
        {
          label: "Open Folder...",
          accelerator: "CmdOrCtrl+K CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow!, {
              properties: ["openDirectory"],
            });
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow?.webContents.send("menu:openFolder", result.filePaths[0]);
            }
          },
        },
        { type: "separator" },
        {
          label: "Save",
          accelerator: "CmdOrCtrl+S",
          click: () => mainWindow?.webContents.send("menu:save"),
        },
        {
          label: "Save As...",
          accelerator: "CmdOrCtrl+Shift+S",
          click: () => mainWindow?.webContents.send("menu:saveAs"),
        },
        { type: "separator" },
        {
          label: "Close Editor",
          accelerator: "CmdOrCtrl+W",
          click: () => mainWindow?.webContents.send("menu:closeEditor"),
        },
        {
          label: "Close Window",
          accelerator: "CmdOrCtrl+Shift+W",
          click: () => mainWindow?.close(),
        },
        { type: "separator" },
        { label: "Exit", accelerator: "Alt+F4", click: () => app.quit() },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { label: "Undo", accelerator: "CmdOrCtrl+Z", role: "undo" },
        { label: "Redo", accelerator: "CmdOrCtrl+Y", role: "redo" },
        { type: "separator" },
        { label: "Cut", accelerator: "CmdOrCtrl+X", role: "cut" },
        { label: "Copy", accelerator: "CmdOrCtrl+C", role: "copy" },
        { label: "Paste", accelerator: "CmdOrCtrl+V", role: "paste" },
        { type: "separator" },
        {
          label: "Find",
          accelerator: "CmdOrCtrl+F",
          click: () => mainWindow?.webContents.send("menu:find"),
        },
        {
          label: "Find in Files",
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => mainWindow?.webContents.send("menu:findInFiles"),
        },
        {
          label: "Replace",
          accelerator: "CmdOrCtrl+H",
          click: () => mainWindow?.webContents.send("menu:replace"),
        },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Command Palette...",
          accelerator: "CmdOrCtrl+Shift+P",
          click: () => mainWindow?.webContents.send("menu:commandPalette"),
        },
        { type: "separator" },
        {
          label: "Explorer",
          accelerator: "CmdOrCtrl+Shift+E",
          click: () => mainWindow?.webContents.send("menu:showExplorer"),
        },
        {
          label: "Search",
          accelerator: "CmdOrCtrl+Shift+F",
          click: () => mainWindow?.webContents.send("menu:showSearch"),
        },
        {
          label: "Source Control",
          accelerator: "CmdOrCtrl+Shift+G",
          click: () => mainWindow?.webContents.send("menu:showGit"),
        },
        { type: "separator" },
        {
          label: "Terminal",
          accelerator: "CmdOrCtrl+`",
          click: () => mainWindow?.webContents.send("menu:toggleTerminal"),
        },
        {
          label: "AI Chat",
          accelerator: "CmdOrCtrl+L",
          click: () => mainWindow?.webContents.send("menu:toggleAI"),
        },
        { type: "separator" },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => mainWindow?.webContents.reload(),
        },
        { type: "separator" },
        {
          label: "Theme",
          submenu: [
            {
              label: "Dark Themes",
              submenu: [
                {
                  label: "MindCode Dark",
                  click: () => mainWindow?.webContents.send("theme:change", "mindcode-dark"),
                },
                {
                  label: "Dark+ (VS Code)",
                  click: () => mainWindow?.webContents.send("theme:change", "dark-plus"),
                },
                { type: "separator" },
                {
                  label: "Catppuccin Mocha",
                  click: () => mainWindow?.webContents.send("theme:change", "catppuccin-mocha"),
                },
                {
                  label: "Catppuccin Macchiato",
                  click: () => mainWindow?.webContents.send("theme:change", "catppuccin-macchiato"),
                },
                {
                  label: "Catppuccin Frappé",
                  click: () => mainWindow?.webContents.send("theme:change", "catppuccin-frappe"),
                },
                { type: "separator" },
                {
                  label: "Tokyo Night",
                  click: () => mainWindow?.webContents.send("theme:change", "tokyo-night"),
                },
                {
                  label: "Tokyo Night Storm",
                  click: () => mainWindow?.webContents.send("theme:change", "tokyo-night-storm"),
                },
                { type: "separator" },
                {
                  label: "Kanagawa Wave",
                  click: () => mainWindow?.webContents.send("theme:change", "kanagawa-wave"),
                },
                {
                  label: "Kanagawa Dragon",
                  click: () => mainWindow?.webContents.send("theme:change", "kanagawa-dragon"),
                },
                { type: "separator" },
                {
                  label: "Dracula",
                  click: () => mainWindow?.webContents.send("theme:change", "dracula"),
                },
                {
                  label: "One Dark Pro",
                  click: () => mainWindow?.webContents.send("theme:change", "one-dark-pro"),
                },
                {
                  label: "Monokai",
                  click: () => mainWindow?.webContents.send("theme:change", "monokai"),
                },
                { type: "separator" },
                {
                  label: "GitHub Dark",
                  click: () => mainWindow?.webContents.send("theme:change", "github-dark"),
                },
                {
                  label: "Nord",
                  click: () => mainWindow?.webContents.send("theme:change", "nord"),
                },
                {
                  label: "Gruvbox Dark",
                  click: () => mainWindow?.webContents.send("theme:change", "gruvbox-dark"),
                },
                {
                  label: "Solarized Dark",
                  click: () => mainWindow?.webContents.send("theme:change", "solarized-dark"),
                },
                { type: "separator" },
                {
                  label: "Rosé Pine",
                  click: () => mainWindow?.webContents.send("theme:change", "rose-pine"),
                },
                {
                  label: "Night Owl",
                  click: () => mainWindow?.webContents.send("theme:change", "night-owl"),
                },
                {
                  label: "Material Ocean",
                  click: () => mainWindow?.webContents.send("theme:change", "material-ocean"),
                },
                {
                  label: "Ayu Dark",
                  click: () => mainWindow?.webContents.send("theme:change", "ayu-dark"),
                },
              ],
            },
            {
              label: "Light Themes",
              submenu: [
                {
                  label: "Light+ (default light)",
                  click: () => mainWindow?.webContents.send("theme:change", "light-plus"),
                },
                {
                  label: "GitHub Light",
                  click: () => mainWindow?.webContents.send("theme:change", "github-light"),
                },
                {
                  label: "Quiet Light",
                  click: () => mainWindow?.webContents.send("theme:change", "quiet-light"),
                },
                { type: "separator" },
                {
                  label: "Catppuccin Latte",
                  click: () => mainWindow?.webContents.send("theme:change", "catppuccin-latte"),
                },
                {
                  label: "Solarized Light",
                  click: () => mainWindow?.webContents.send("theme:change", "solarized-light"),
                },
                {
                  label: "One Light",
                  click: () => mainWindow?.webContents.send("theme:change", "one-light"),
                },
                {
                  label: "Rosé Pine Dawn",
                  click: () => mainWindow?.webContents.send("theme:change", "rose-pine-dawn"),
                },
              ],
            },
            {
              label: "High Contrast",
              submenu: [
                {
                  label: "Dark High Contrast",
                  click: () => mainWindow?.webContents.send("theme:change", "hc-black"),
                },
                {
                  label: "Light High Contrast",
                  click: () => mainWindow?.webContents.send("theme:change", "hc-light"),
                },
              ],
            },
            { type: "separator" },
            {
              label: "Follow System",
              click: () => mainWindow?.webContents.send("theme:change", "system"),
            },
          ],
        },
        { type: "separator" },
        { label: "Zoom In", accelerator: "CmdOrCtrl+=", role: "zoomIn" },
        { label: "Zoom Out", accelerator: "CmdOrCtrl+-", role: "zoomOut" },
        { label: "Reset Zoom", accelerator: "CmdOrCtrl+0", role: "resetZoom" },
        { type: "separator" },
        { label: "Toggle Full Screen", accelerator: "F11", role: "togglefullscreen" },
      ],
    },
    {
      label: "Go",
      submenu: [
        {
          label: "Go to File...",
          accelerator: "CmdOrCtrl+P",
          click: () => mainWindow?.webContents.send("menu:goToFile"),
        },
        {
          label: "Go to Line...",
          accelerator: "CmdOrCtrl+G",
          click: () => mainWindow?.webContents.send("menu:goToLine"),
        },
      ],
    },
    {
      label: "Terminal",
      submenu: [
        {
          label: "New Terminal",
          accelerator: "CmdOrCtrl+Shift+`",
          click: () => mainWindow?.webContents.send("menu:newTerminal"),
        },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Toggle Developer Tools",
          accelerator: "F12",
          click: () => mainWindow?.webContents.toggleDevTools(),
        },
        { type: "separator" },
        {
          label: "About MindCode",
          click: () => {
            dialog.showMessageBox(mainWindow!, {
              type: "info",
              title: "About MindCode",
              message: "MindCode",
              detail:
                "AI-Native Code Editor\nVersion 0.3.0\n\nBuilt with Electron + React + TypeScript",
            });
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ==================== App Lifecycle ====================
app.whenReady().then(() => {
  markStartup("app_ready");

  // CSP 安全策略
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          isDev
            ? "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:* http://localhost:*; font-src 'self' data:; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none';"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; font-src 'self' data:; img-src 'self' data: blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';",
        ],
      },
    });
  });

  // 初始化日志系统（必须在 IPC 注册之前）
  initLogging(isDev);

  createMenu();
  createWindow();

  // 注册所有 IPC 处理器
  registerFSHandlers(ipcContext);
  registerAIHandlers(ipcContext);
  registerGitHandlers(ipcContext);
  registerTerminalHandlers(ipcContext);
  registerSettingsHandlers(ipcContext);
  registerDebugHandlers(ipcContext);
  registerLSPHandlers(ipcContext);
  registerIndexHandlers(ipcContext);
  registerDashboardHandlers(ipcContext);
  registerPluginHandlers(ipcContext);

  // 并行预热 AI Provider
  warmupAIProviders();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
