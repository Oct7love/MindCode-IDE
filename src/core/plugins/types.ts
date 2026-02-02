/**
 * 插件系统类型定义
 * MindCode Extension API
 */

// ============ 插件清单 ============

export interface PluginManifest {
  id: string; // 唯一标识 (如 mindcode.hello-world)
  name: string; // 显示名称
  version: string; // 语义化版本
  description?: string;
  author?: string;
  main: string; // 入口文件
  permissions: PluginPermission[]; // 所需权限
  contributes?: PluginContributes; // 贡献点
  activationEvents?: string[]; // 激活事件 (如 onCommand:*, onLanguage:typescript)
  engines?: { mindcode: string }; // 兼容性要求
}

// ============ 权限 ============

export type PluginPermission = 
  | 'fs.read' // 读取文件
  | 'fs.write' // 写入文件
  | 'terminal' // 终端访问
  | 'git' // Git 操作
  | 'network' // 网络请求
  | 'ai' // AI API 调用
  | 'editor' // 编辑器操作
  | 'workspace'; // 工作区操作

// ============ 贡献点 ============

export interface PluginContributes {
  commands?: CommandContribution[];
  menus?: MenuContribution[];
  keybindings?: KeybindingContribution[];
  languages?: LanguageContribution[];
  themes?: ThemeContribution[];
  views?: ViewContribution[];
  configuration?: ConfigurationContribution;
}

export interface CommandContribution { command: string; title: string; category?: string; icon?: string; }
export interface MenuContribution { command: string; when?: string; group?: string; }
export interface KeybindingContribution { command: string; key: string; when?: string; }
export interface LanguageContribution { id: string; extensions?: string[]; aliases?: string[]; }
export interface ThemeContribution { id: string; label: string; path: string; }
export interface ViewContribution { id: string; name: string; when?: string; }
export interface ConfigurationContribution { title: string; properties: Record<string, { type: string; default?: any; description?: string }>; }

// ============ 插件实例 ============

export interface PluginInstance {
  manifest: PluginManifest;
  state: PluginState;
  exports?: any; // 插件导出的 API
  context: PluginContext;
}

export type PluginState = 'inactive' | 'activating' | 'active' | 'deactivating' | 'error';

// ============ 插件上下文 ============

export interface PluginContext {
  pluginId: string;
  pluginPath: string;
  storagePath: string; // 插件专属存储目录
  subscriptions: Disposable[]; // 需要清理的资源
  globalState: StateStorage; // 全局状态存储
  workspaceState: StateStorage; // 工作区状态存储
}

export interface Disposable { dispose(): void; }
export interface StateStorage { get<T>(key: string, defaultValue?: T): T | undefined; update(key: string, value: any): Promise<void>; }

// ============ 插件 API ============

export interface PluginAPI {
  // 编辑器
  editor: {
    getActiveEditor(): any;
    openFile(path: string): Promise<void>;
    showMessage(message: string, type?: 'info' | 'warning' | 'error'): void;
  };
  // 命令
  commands: {
    registerCommand(command: string, callback: (...args: any[]) => any): Disposable;
    executeCommand(command: string, ...args: any[]): Promise<any>;
  };
  // 文件系统
  fs: {
    readFile(path: string): Promise<string>;
    writeFile(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  };
  // 窗口
  window: {
    showInputBox(options?: { prompt?: string; value?: string }): Promise<string | undefined>;
    showQuickPick(items: string[], options?: { placeholder?: string }): Promise<string | undefined>;
  };
}

// ============ 激活函数签名 ============

export type ActivateFunction = (context: PluginContext, api: PluginAPI) => void | Promise<void>;
export type DeactivateFunction = () => void | Promise<void>;
