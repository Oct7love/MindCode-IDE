/**
 * 插件加载器
 * 负责加载、激活、停用插件
 */

import type {
  PluginManifest,
  PluginInstance,
  PluginContext,
  PluginAPI,
  PluginState,
  ActivateFunction,
  DeactivateFunction,
} from "./types";

/** 插件加载器全局 API */
interface PluginLoaderWindow {
  mindcode?: {
    plugins?: {
      loadModule?: (path: string) => Promise<Record<string, unknown>>;
    };
  };
}
const win = (typeof window !== "undefined" ? window : null) as (Window & PluginLoaderWindow) | null;

/** API 工厂函数类型：根据 manifest 权限创建沙盒化 API */
type APIFactory = (manifest: PluginManifest) => PluginAPI;

export class PluginLoader {
  private plugins = new Map<string, PluginInstance>();
  private apiFactory: APIFactory;

  constructor(apiFactory: APIFactory) {
    this.apiFactory = apiFactory;
  }

  /** 校验 manifest 基本合法性 */
  private validateManifest(manifest: PluginManifest): string | null {
    if (!manifest.id || typeof manifest.id !== "string") return "Missing or invalid 'id'";
    if (!manifest.main || typeof manifest.main !== "string") return "Missing or invalid 'main'";
    if (!manifest.name || typeof manifest.name !== "string") return "Missing or invalid 'name'";
    if (!manifest.version || typeof manifest.version !== "string")
      return "Missing or invalid 'version'";
    if (!Array.isArray(manifest.permissions)) return "Missing 'permissions' array";
    // id 格式校验：仅允许字母、数字、点、连字符
    if (!/^[a-zA-Z0-9][a-zA-Z0-9.\-]*$/.test(manifest.id))
      return `Invalid plugin id format: ${manifest.id}`;
    // main 路径不能包含路径穿越
    if (manifest.main.includes("..")) return "Plugin 'main' path traversal detected";
    return null;
  }

  /** 加载插件（含 manifest 校验） */
  async loadPlugin(manifestPath: string): Promise<PluginInstance | null> {
    try {
      // 创建临时无权限 API 用于读取 manifest
      const tempApi = this.apiFactory({
        id: "__loader__",
        name: "Loader",
        version: "0",
        main: "",
        permissions: ["fs.read"],
      } as PluginManifest);

      // 读取 manifest
      const manifestContent = await tempApi.fs.readFile(manifestPath);
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // 严格校验 manifest
      const validationError = this.validateManifest(manifest);
      if (validationError) throw new Error(`Invalid manifest: ${validationError}`);

      // 检查是否已加载
      if (this.plugins.has(manifest.id)) {
        console.warn(`[PluginLoader] 插件已加载: ${manifest.id}`);
        return this.plugins.get(manifest.id)!;
      }

      // 记录所请求的权限
      console.log(
        `[PluginLoader] 插件 ${manifest.id} 请求权限: [${manifest.permissions.join(", ")}]`,
      );

      // 创建上下文
      const pluginPath = manifestPath.replace(/[/\\]manifest\.json$/, "");
      const context: PluginContext = {
        pluginId: manifest.id,
        pluginPath,
        storagePath: `${pluginPath}/.storage`,
        subscriptions: [],
        globalState: this.createStateStorage(`plugin:${manifest.id}:global`),
        workspaceState: this.createStateStorage(`plugin:${manifest.id}:workspace`),
      };

      const instance: PluginInstance = { manifest, state: "inactive", context };
      this.plugins.set(manifest.id, instance);
      console.log(`[PluginLoader] 插件已加载: ${manifest.id}`);
      return instance;
    } catch (err) {
      console.error(`[PluginLoader] 加载失败: ${manifestPath}`, err);
      return null;
    }
  }

  /** 激活插件（使用基于权限的沙盒化 API） */
  async activatePlugin(pluginId: string): Promise<boolean> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      console.error(`[PluginLoader] 插件未找到: ${pluginId}`);
      return false;
    }
    if (instance.state === "active") return true;

    instance.state = "activating";
    try {
      // 为每个插件创建独立的权限受限 API
      const sandboxedApi = this.apiFactory(instance.manifest);

      // 动态加载入口模块
      const mainPath = `${instance.context.pluginPath}/${instance.manifest.main}`;
      const module = await this.loadModule(mainPath);
      if (module?.activate) {
        const activate = module.activate as ActivateFunction;
        await activate(instance.context, sandboxedApi);
      }
      instance.exports = module;
      instance.state = "active";
      console.log(
        `[PluginLoader] 插件已激活: ${pluginId} (权限: [${instance.manifest.permissions.join(", ")}])`,
      );
      return true;
    } catch (err) {
      console.error(`[PluginLoader] 激活失败: ${pluginId}`, err);
      instance.state = "error";
      return false;
    }
  }

  /** 停用插件 */
  async deactivatePlugin(pluginId: string): Promise<boolean> {
    const instance = this.plugins.get(pluginId);
    if (!instance || instance.state !== "active") return false;

    instance.state = "deactivating";
    try {
      // 调用 deactivate
      const exports = instance.exports as Record<string, unknown> | undefined;
      if (exports?.deactivate) {
        const deactivate = exports.deactivate as DeactivateFunction;
        await deactivate();
      }
      // 清理订阅
      for (const sub of instance.context.subscriptions) {
        try {
          sub.dispose();
        } catch {}
      }
      instance.context.subscriptions = [];
      instance.state = "inactive";
      console.log(`[PluginLoader] 插件已停用: ${pluginId}`);
      return true;
    } catch (err) {
      console.error(`[PluginLoader] 停用失败: ${pluginId}`, err);
      instance.state = "error";
      return false;
    }
  }

  /** 卸载插件 */
  async unloadPlugin(pluginId: string): Promise<void> {
    await this.deactivatePlugin(pluginId);
    this.plugins.delete(pluginId);
  }

  /** 获取插件实例 */
  getPlugin(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  /** 列出所有插件 */
  listPlugins(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /** 获取插件状态 */
  getPluginState(pluginId: string): PluginState | undefined {
    return this.plugins.get(pluginId)?.state;
  }

  // ============ 私有方法 ============

  private async loadModule(path: string): Promise<Record<string, unknown> | null> {
    // 在浏览器环境中使用动态 import 或 eval（简化版）
    // 生产环境应使用 Worker 或 iframe 沙箱
    try {
      if (win?.mindcode?.plugins?.loadModule) return await win.mindcode.plugins.loadModule(path);
      console.warn("[PluginLoader] 插件模块加载未实现");
      return null;
    } catch {
      return null;
    }
  }

  private createStateStorage(prefix: string) {
    return {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        const stored = localStorage.getItem(`${prefix}:${key}`);
        return stored ? JSON.parse(stored) : defaultValue;
      },
      update: async (key: string, value: unknown): Promise<void> => {
        localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value));
      },
    };
  }
}
