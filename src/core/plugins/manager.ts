/**
 * 插件管理器
 * 整合加载器、命令注册表、API 注入
 * 基于 manifest.permissions 的沙盒权限模型
 */

import type {
  PluginAPI,
  PluginInstance,
  PluginManifest,
  PluginPermission,
  Disposable,
} from "./types";
import { PluginLoader } from "./loader";
import type { CommandRegistry } from "./commands";
import { getCommandRegistry } from "./commands";
import { logger } from "../logger";

const log = logger.child("PluginManager");

/** Monaco 编辑器实例（插件 API 中使用的子集） */
interface MonacoEditorInstance {
  deltaDecorations: (oldDecorations: unknown[], newDecorations: unknown[]) => void;
  getSelection?: () => {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  } | null;
  getModel?: () => { getValueInRange?: (range: unknown) => string } | null;
  trigger?: (source: string, handlerId: string, payload: unknown) => void;
}

/** MindCode 全局 API 接口（插件系统使用的子集，兼容主进程无 window 场景） */
interface MindCodeWindow {
  mindcode?: {
    fs?: {
      listDir?: (path: string) => Promise<{ data?: Array<{ name: string; isDirectory: boolean }> }>;
      readFile?: (path: string) => Promise<{ data?: string }>;
      writeFile?: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
      exists?: (path: string) => Promise<boolean>;
      openFile?: (path: string) => Promise<void>;
    };
    editor?: {
      getActive?: () => MonacoEditorInstance | null;
    };
    workspace?: {
      getPath?: () => string | null;
      onSave?: (handler: (event: unknown, path: string) => void) => void;
      offSave?: (handler: (event: unknown, path: string) => void) => void;
      onOpen?: (handler: (event: unknown, path: string) => void) => void;
      offOpen?: (handler: (event: unknown, path: string) => void) => void;
    };
    ai?: {
      chat?: (prompt: string, options?: unknown) => Promise<{ content?: string }>;
      complete?: (params: { prefix: string; suffix?: string }) => Promise<{ completion?: string }>;
    };
    config?: {
      get?: (key: string) => unknown;
    };
    terminal?: {
      execute?: (command: string, cwd?: string | null) => Promise<unknown>;
    };
  };
}
const win: MindCodeWindow | null =
  typeof window !== "undefined" ? (window as unknown as MindCodeWindow) : null;

/** 权限不足时抛出的错误 */
function permissionDenied(pluginId: string, permission: PluginPermission): never {
  throw new Error(`[Plugin:${pluginId}] Permission denied: requires "${permission}"`);
}

/** 校验路径是否在允许范围内（工作区 + 插件存储目录） */
function isPluginPathAllowed(
  targetPath: string,
  workspacePath: string | null,
  pluginPath: string,
): boolean {
  const normalized = targetPath.replace(/\\/g, "/");
  const normalizedWorkspace = workspacePath?.replace(/\\/g, "/");
  const normalizedPlugin = pluginPath.replace(/\\/g, "/");

  // 禁止路径穿越
  if (normalized.includes("..")) return false;

  // 允许访问插件自身目录
  if (normalized.startsWith(normalizedPlugin + "/") || normalized === normalizedPlugin) return true;

  // 允许访问工作区目录
  if (
    normalizedWorkspace &&
    (normalized.startsWith(normalizedWorkspace + "/") || normalized === normalizedWorkspace)
  )
    return true;

  return false;
}

export class PluginManager {
  private loader: PluginLoader;
  private commandRegistry: CommandRegistry;
  private pluginsDir: string;

  constructor(pluginsDir: string = "./plugins") {
    this.pluginsDir = pluginsDir;
    this.commandRegistry = getCommandRegistry();
    this.loader = new PluginLoader(this.createSandboxedAPI.bind(this));
  }

  /** 初始化 - 扫描并加载所有插件 */
  async init(): Promise<void> {
    log.info("初始化插件系统...");
    await this.scanAndLoadPlugins();
  }

  /** 扫描插件目录并加载 */
  async scanAndLoadPlugins(): Promise<void> {
    try {
      if (!win?.mindcode?.fs?.listDir) return;
      const files = await win?.mindcode?.fs?.listDir?.(this.pluginsDir);
      for (const file of files.data || []) {
        if (file.isDirectory) {
          const manifestPath = `${this.pluginsDir}/${file.name}/manifest.json`;
          const exists = await win?.mindcode?.fs?.exists?.(manifestPath);
          if (exists) await this.loader.loadPlugin(manifestPath);
        }
      }
    } catch (err) {
      log.error("扫描插件失败:", err);
    }
  }

  /** 激活所有已加载插件 */
  async activateAll(): Promise<void> {
    for (const plugin of this.loader.listPlugins()) {
      if (plugin.state === "inactive") await this.loader.activatePlugin(plugin.manifest.id);
    }
  }

  /** 激活指定插件 */
  async activate(pluginId: string): Promise<boolean> {
    return this.loader.activatePlugin(pluginId);
  }

  /** 停用指定插件 */
  async deactivate(pluginId: string): Promise<boolean> {
    return this.loader.deactivatePlugin(pluginId);
  }

  /** 安装插件（从路径） */
  async install(manifestPath: string): Promise<boolean> {
    const instance = await this.loader.loadPlugin(manifestPath);
    if (instance) {
      await this.loader.activatePlugin(instance.manifest.id);
      return true;
    }
    return false;
  }

  /** 卸载插件 */
  async uninstall(pluginId: string): Promise<void> {
    await this.loader.unloadPlugin(pluginId);
  }

  /** 列出所有插件 */
  listPlugins(): PluginInstance[] {
    return this.loader.listPlugins();
  }

  /** 获取命令注册表 */
  getCommandRegistry(): CommandRegistry {
    return this.commandRegistry;
  }

  /** 执行命令 */
  async executeCommand(command: string, ...args: unknown[]): Promise<unknown> {
    return this.commandRegistry.executeCommand(command, ...args);
  }

  // ============ 创建沙盒化插件 API ============

  /** 根据 manifest.permissions 创建权限受限的 API */
  private createSandboxedAPI(manifest: PluginManifest): PluginAPI {
    const registry = this.commandRegistry;
    const perms = new Set(manifest.permissions || []);
    const pluginId = manifest.id;
    const decorationTypes = new Map<string, Record<string, unknown>>();
    let decorationId = 0;

    // 获取插件路径（用于 fs 路径校验）
    const pluginPath = `${this.pluginsDir}/${manifest.id.split(".").pop() || manifest.id}`;

    /** 校验 fs 路径合法性 */
    const validatePath = (fsPath: string): void => {
      const workspacePath = win?.mindcode?.workspace?.getPath?.() || null;
      if (!isPluginPathAllowed(fsPath, workspacePath, pluginPath)) {
        throw new Error(`[Plugin:${pluginId}] Path access denied: ${fsPath}`);
      }
    };

    return {
      editor: {
        getActiveEditor: () => {
          if (!perms.has("editor")) permissionDenied(pluginId, "editor");
          return win?.mindcode?.editor?.getActive?.();
        },
        openFile: async (path) => {
          if (!perms.has("editor")) permissionDenied(pluginId, "editor");
          return win?.mindcode?.fs?.openFile?.(path);
        },
        showMessage: (message, type = "info") => {
          // showMessage 不需要特殊权限
          if (type === "error") console.error(`[Plugin:${pluginId}]`, message);
          else if (type === "warning") console.warn(`[Plugin:${pluginId}]`, message);
          else console.log(`[Plugin:${pluginId}]`, message);
        },
        setDecorations: (decorationType, ranges) => {
          if (!perms.has("editor")) permissionDenied(pluginId, "editor");
          const editor = win?.mindcode?.editor?.getActive?.();
          if (editor?.deltaDecorations)
            editor.deltaDecorations(
              [],
              ranges.map((r) => ({
                range: r.range,
                options: decorationTypes.get(decorationType) || {},
              })),
            );
        },
        createDecorationType: (options) => {
          if (!perms.has("editor")) permissionDenied(pluginId, "editor");
          const id = `decoration-${++decorationId}`;
          decorationTypes.set(id, options);
          return id;
        },
        getSelection: () => {
          if (!perms.has("editor")) permissionDenied(pluginId, "editor");
          const editor = win?.mindcode?.editor?.getActive?.();
          if (!editor) return null;
          const sel = editor.getSelection?.();
          return sel
            ? {
                start: { line: sel.startLineNumber, col: sel.startColumn },
                end: { line: sel.endLineNumber, col: sel.endColumn },
                text: editor.getModel?.()?.getValueInRange?.(sel) || "",
              }
            : null;
        },
        insertText: (text) => {
          if (!perms.has("editor")) permissionDenied(pluginId, "editor");
          const editor = win?.mindcode?.editor?.getActive?.();
          editor?.trigger?.("plugin", "type", { text });
        },
      },
      commands: {
        registerCommand: (command, callback): Disposable =>
          registry.registerCommand(command, callback),
        executeCommand: async (command, ...args) => registry.executeCommand(command, ...args),
      },
      fs: {
        readFile: async (path) => {
          if (!perms.has("fs.read")) permissionDenied(pluginId, "fs.read");
          validatePath(path);
          const r = await win?.mindcode?.fs?.readFile?.(path);
          return r?.data || "";
        },
        writeFile: async (path, content) => {
          if (!perms.has("fs.write")) permissionDenied(pluginId, "fs.write");
          validatePath(path);
          await win?.mindcode?.fs?.writeFile?.(path, content);
        },
        exists: async (path) => {
          if (!perms.has("fs.read")) permissionDenied(pluginId, "fs.read");
          validatePath(path);
          return win?.mindcode?.fs?.exists?.(path) || false;
        },
        listDir: async (path) => {
          if (!perms.has("fs.read")) permissionDenied(pluginId, "fs.read");
          validatePath(path);
          const r = await win?.mindcode?.fs?.listDir?.(path);
          return (r?.data || []).map((f: { name: string; isDirectory: boolean }) => ({
            name: f.name,
            isDirectory: f.isDirectory,
          }));
        },
      },
      window: {
        showInputBox: async (options) =>
          prompt(options?.prompt || options?.placeholder || "", options?.value) || undefined,
        showQuickPick: async (items, options) => {
          const idx = parseInt(
            prompt(
              `${options?.placeholder || "选择"}\n${items.map((it, i) => `${i}: ${it}`).join("\n")}`,
            ) || "-1",
          );
          return idx >= 0 && idx < items.length
            ? options?.canPickMany
              ? [items[idx]]
              : items[idx]
            : undefined;
        },
        showNotification: (message, options) => {
          const type = options?.type || "info";
          console.log(`[Plugin:${pluginId}] [${type.toUpperCase()}] ${message}`);
        },
        showProgress: async (title, task) => {
          console.log(`[Plugin:${pluginId}] [Progress] ${title}`);
          await task({
            report: (v) => console.log(`[Progress] ${v.message || ""} ${v.increment || ""}%`),
          });
        },
        createStatusBarItem: (options) => ({
          text: options.text,
          tooltip: options.tooltip,
          show: () => console.log(`[Plugin:${pluginId}] [StatusBar] ${options.text}`),
          hide: () => {},
          dispose: () => {},
        }),
      },
      workspace: {
        getWorkspacePath: () => {
          if (!perms.has("workspace")) permissionDenied(pluginId, "workspace");
          return win?.mindcode?.workspace?.getPath?.() || null;
        },
        onDidSaveFile: (handler) => {
          if (!perms.has("workspace")) permissionDenied(pluginId, "workspace");
          const h = (_: unknown, path: string) => handler(path);
          win?.mindcode?.workspace?.onSave?.(h);
          return { dispose: () => win?.mindcode?.workspace?.offSave?.(h) };
        },
        onDidOpenFile: (handler) => {
          if (!perms.has("workspace")) permissionDenied(pluginId, "workspace");
          const h = (_: unknown, path: string) => handler(path);
          win?.mindcode?.workspace?.onOpen?.(h);
          return { dispose: () => win?.mindcode?.workspace?.offOpen?.(h) };
        },
        getConfiguration: (section) => ({
          get: <T>(key: string, defaultValue?: T) =>
            (win?.mindcode?.config?.get?.(`${section ? section + "." : ""}${key}`) ??
              defaultValue) as T,
        }),
      },
      ai: {
        chat: async (prompt, options) => {
          if (!perms.has("ai")) permissionDenied(pluginId, "ai");
          const r = await win?.mindcode?.ai?.chat?.(prompt, options);
          return r?.content || "";
        },
        complete: async (prefix, suffix) => {
          if (!perms.has("ai")) permissionDenied(pluginId, "ai");
          const r = await win?.mindcode?.ai?.complete?.({ prefix, suffix });
          return r?.completion || "";
        },
      },
    };
  }
}

// 全局单例
let _manager: PluginManager | null = null;
export function getPluginManager(): PluginManager {
  if (!_manager) _manager = new PluginManager();
  return _manager;
}
