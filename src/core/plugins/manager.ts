/**
 * 插件管理器
 * 整合加载器、命令注册表、API 注入
 */

import type { PluginAPI, PluginInstance, Disposable } from './types';
import { PluginLoader } from './loader';
import { CommandRegistry, getCommandRegistry } from './commands';

export class PluginManager {
  private loader: PluginLoader;
  private commandRegistry: CommandRegistry;
  private pluginsDir: string;

  constructor(pluginsDir: string = './plugins') {
    this.pluginsDir = pluginsDir;
    this.commandRegistry = getCommandRegistry();
    this.loader = new PluginLoader(this.createAPI());
  }

  /** 初始化 - 扫描并加载所有插件 */
  async init(): Promise<void> {
    console.log('[PluginManager] 初始化插件系统...');
    await this.scanAndLoadPlugins();
  }

  /** 扫描插件目录并加载 */
  async scanAndLoadPlugins(): Promise<void> {
    try {
      if (!window.mindcode?.fs?.listDir) return;
      const files = await window.mindcode.fs.listDir(this.pluginsDir);
      for (const file of files.data || []) {
        if (file.isDirectory) {
          const manifestPath = `${this.pluginsDir}/${file.name}/manifest.json`;
          const exists = await window.mindcode.fs.exists?.(manifestPath);
          if (exists) await this.loader.loadPlugin(manifestPath);
        }
      }
    } catch (err) { console.error('[PluginManager] 扫描插件失败:', err); }
  }

  /** 激活所有已加载插件 */
  async activateAll(): Promise<void> {
    for (const plugin of this.loader.listPlugins()) {
      if (plugin.state === 'inactive') await this.loader.activatePlugin(plugin.manifest.id);
    }
  }

  /** 激活指定插件 */
  async activate(pluginId: string): Promise<boolean> { return this.loader.activatePlugin(pluginId); }

  /** 停用指定插件 */
  async deactivate(pluginId: string): Promise<boolean> { return this.loader.deactivatePlugin(pluginId); }

  /** 安装插件（从路径） */
  async install(manifestPath: string): Promise<boolean> {
    const instance = await this.loader.loadPlugin(manifestPath);
    if (instance) { await this.loader.activatePlugin(instance.manifest.id); return true; }
    return false;
  }

  /** 卸载插件 */
  async uninstall(pluginId: string): Promise<void> { await this.loader.unloadPlugin(pluginId); }

  /** 列出所有插件 */
  listPlugins(): PluginInstance[] { return this.loader.listPlugins(); }

  /** 获取命令注册表 */
  getCommandRegistry(): CommandRegistry { return this.commandRegistry; }

  /** 执行命令 */
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    return this.commandRegistry.executeCommand(command, ...args);
  }

  // ============ 创建插件 API ============

  private createAPI(): PluginAPI {
    const registry = this.commandRegistry;
    return {
      editor: {
        getActiveEditor: () => window.mindcode?.editor?.getActive?.(),
        openFile: async (path) => window.mindcode?.fs?.openFile?.(path),
        showMessage: (message, type = 'info') => {
          if (type === 'error') console.error(message);
          else if (type === 'warning') console.warn(message);
          else console.log(message);
          // TODO: 集成通知系统
        },
      },
      commands: {
        registerCommand: (command, callback): Disposable => registry.registerCommand(command, callback),
        executeCommand: async (command, ...args) => registry.executeCommand(command, ...args),
      },
      fs: {
        readFile: async (path) => { const r = await window.mindcode?.fs?.readFile?.(path); return r?.data || ''; },
        writeFile: async (path, content) => { await window.mindcode?.fs?.writeFile?.(path, content); },
        exists: async (path) => window.mindcode?.fs?.exists?.(path) || false,
      },
      window: {
        showInputBox: async (options) => prompt(options?.prompt || '', options?.value) || undefined,
        showQuickPick: async (items, options) => {
          const index = parseInt(prompt(`${options?.placeholder || '选择'}\n${items.map((it, i) => `${i}: ${it}`).join('\n')}`) || '-1');
          return index >= 0 && index < items.length ? items[index] : undefined;
        },
      },
    };
  }
}

// 全局单例
let _manager: PluginManager | null = null;
export function getPluginManager(): PluginManager { if (!_manager) _manager = new PluginManager(); return _manager; }
