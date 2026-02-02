/**
 * 插件加载器
 * 负责加载、激活、停用插件
 */

import type { PluginManifest, PluginInstance, PluginContext, PluginAPI, PluginState, Disposable, ActivateFunction, DeactivateFunction } from './types';

const win = window as any; // 类型断言简化

export class PluginLoader {
  private plugins = new Map<string, PluginInstance>();
  private api: PluginAPI;

  constructor(api: PluginAPI) { this.api = api; }

  /** 加载插件 */
  async loadPlugin(manifestPath: string): Promise<PluginInstance | null> {
    try {
      // 读取 manifest
      const manifestContent = await this.api.fs.readFile(manifestPath);
      const manifest: PluginManifest = JSON.parse(manifestContent);
      if (!manifest.id || !manifest.main) throw new Error('Invalid manifest');

      // 检查是否已加载
      if (this.plugins.has(manifest.id)) { console.warn(`[PluginLoader] 插件已加载: ${manifest.id}`); return this.plugins.get(manifest.id)!; }

      // 创建上下文
      const pluginPath = manifestPath.replace(/[/\\]manifest\.json$/, '');
      const context: PluginContext = {
        pluginId: manifest.id,
        pluginPath,
        storagePath: `${pluginPath}/.storage`,
        subscriptions: [],
        globalState: this.createStateStorage(`plugin:${manifest.id}:global`),
        workspaceState: this.createStateStorage(`plugin:${manifest.id}:workspace`),
      };

      const instance: PluginInstance = { manifest, state: 'inactive', context };
      this.plugins.set(manifest.id, instance);
      console.log(`[PluginLoader] 插件已加载: ${manifest.id}`);
      return instance;
    } catch (err) { console.error(`[PluginLoader] 加载失败: ${manifestPath}`, err); return null; }
  }

  /** 激活插件 */
  async activatePlugin(pluginId: string): Promise<boolean> {
    const instance = this.plugins.get(pluginId);
    if (!instance) { console.error(`[PluginLoader] 插件未找到: ${pluginId}`); return false; }
    if (instance.state === 'active') return true;

    instance.state = 'activating';
    try {
      // 动态加载入口模块
      const mainPath = `${instance.context.pluginPath}/${instance.manifest.main}`;
      const module = await this.loadModule(mainPath);
      if (module?.activate) {
        const activate = module.activate as ActivateFunction;
        await activate(instance.context, this.api);
      }
      instance.exports = module;
      instance.state = 'active';
      console.log(`[PluginLoader] 插件已激活: ${pluginId}`);
      return true;
    } catch (err) { console.error(`[PluginLoader] 激活失败: ${pluginId}`, err); instance.state = 'error'; return false; }
  }

  /** 停用插件 */
  async deactivatePlugin(pluginId: string): Promise<boolean> {
    const instance = this.plugins.get(pluginId);
    if (!instance || instance.state !== 'active') return false;

    instance.state = 'deactivating';
    try {
      // 调用 deactivate
      if (instance.exports?.deactivate) {
        const deactivate = instance.exports.deactivate as DeactivateFunction;
        await deactivate();
      }
      // 清理订阅
      for (const sub of instance.context.subscriptions) { try { sub.dispose(); } catch {} }
      instance.context.subscriptions = [];
      instance.state = 'inactive';
      console.log(`[PluginLoader] 插件已停用: ${pluginId}`);
      return true;
    } catch (err) { console.error(`[PluginLoader] 停用失败: ${pluginId}`, err); instance.state = 'error'; return false; }
  }

  /** 卸载插件 */
  async unloadPlugin(pluginId: string): Promise<void> {
    await this.deactivatePlugin(pluginId);
    this.plugins.delete(pluginId);
  }

  /** 获取插件实例 */
  getPlugin(pluginId: string): PluginInstance | undefined { return this.plugins.get(pluginId); }

  /** 列出所有插件 */
  listPlugins(): PluginInstance[] { return Array.from(this.plugins.values()); }

  /** 获取插件状态 */
  getPluginState(pluginId: string): PluginState | undefined { return this.plugins.get(pluginId)?.state; }

  // ============ 私有方法 ============

  private async loadModule(path: string): Promise<any> {
    // 在浏览器环境中使用动态 import 或 eval（简化版）
    // 生产环境应使用 Worker 或 iframe 沙箱
    try {
      if (win.mindcode?.plugins?.loadModule) return await win.mindcode.plugins.loadModule(path);
      console.warn('[PluginLoader] 插件模块加载未实现');
      return null;
    } catch { return null; }
  }

  private createStateStorage(prefix: string) {
    return {
      get: <T>(key: string, defaultValue?: T): T | undefined => {
        const stored = localStorage.getItem(`${prefix}:${key}`);
        return stored ? JSON.parse(stored) : defaultValue;
      },
      update: async (key: string, value: any): Promise<void> => {
        localStorage.setItem(`${prefix}:${key}`, JSON.stringify(value));
      },
    };
  }
}
