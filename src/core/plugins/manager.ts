/**
 * 插件管理器
 * 整合加载器、命令注册表、API 注入
 */

import type { PluginAPI, PluginInstance, Disposable } from "./types";
import { PluginLoader } from "./loader";
import type { CommandRegistry } from "./commands";
import { getCommandRegistry } from "./commands";

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

export class PluginManager {
  private loader: PluginLoader;
  private commandRegistry: CommandRegistry;
  private pluginsDir: string;

  constructor(pluginsDir: string = "./plugins") {
    this.pluginsDir = pluginsDir;
    this.commandRegistry = getCommandRegistry();
    this.loader = new PluginLoader(this.createAPI());
  }

  /** 初始化 - 扫描并加载所有插件 */
  async init(): Promise<void> {
    console.log("[PluginManager] 初始化插件系统...");
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
      console.error("[PluginManager] 扫描插件失败:", err);
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

  // ============ 创建插件 API ============

  private createAPI(): PluginAPI {
    const registry = this.commandRegistry;
    const decorationTypes = new Map<string, Record<string, unknown>>();
    let decorationId = 0;
    return {
      editor: {
        getActiveEditor: () => win?.mindcode?.editor?.getActive?.(),
        openFile: async (path) => win?.mindcode?.fs?.openFile?.(path),
        showMessage: (message, type = "info") => {
          if (type === "error") console.error(message);
          else if (type === "warning") console.warn(message);
          else console.log(message);
        },
        setDecorations: (decorationType, ranges) => {
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
          const id = `decoration-${++decorationId}`;
          decorationTypes.set(id, options);
          return id;
        },
        getSelection: () => {
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
          const r = await win?.mindcode?.fs?.readFile?.(path);
          return r?.data || "";
        },
        writeFile: async (path, content) => {
          await win?.mindcode?.fs?.writeFile?.(path, content);
        },
        exists: async (path) => win?.mindcode?.fs?.exists?.(path) || false,
        listDir: async (path) => {
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
          console.log(`[${type.toUpperCase()}] ${message}`);
        },
        showProgress: async (title, task) => {
          console.log(`[Progress] ${title}`);
          await task({
            report: (v) => console.log(`[Progress] ${v.message || ""} ${v.increment || ""}%`),
          });
        },
        createStatusBarItem: (options) => ({
          text: options.text,
          tooltip: options.tooltip,
          show: () => console.log(`[StatusBar] ${options.text}`),
          hide: () => {},
          dispose: () => {},
        }),
      },
      workspace: {
        getWorkspacePath: () => win?.mindcode?.workspace?.getPath?.() || null,
        onDidSaveFile: (handler) => {
          const h = (_: unknown, path: string) => handler(path);
          win?.mindcode?.workspace?.onSave?.(h);
          return { dispose: () => win?.mindcode?.workspace?.offSave?.(h) };
        },
        onDidOpenFile: (handler) => {
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
          const r = await win?.mindcode?.ai?.chat?.(prompt, options);
          return r?.content || "";
        },
        complete: async (prefix, suffix) => {
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
