/**
 * Core - 核心层统一导出
 */

// AI 模块
export * from './ai';

// Agent 模块
export * from './agent';

// Indexing 模块
export * from './indexing';

// LSP 模块 (避免 SymbolKind 冲突)
export { LSPClient, getLSPClient, createLSPClient, stopAllLSPClients, LANGUAGE_SERVERS } from './lsp';
export type { LSPClientConfig, Position as LSPPosition, Diagnostic, CompletionItem, Hover, Location, DocumentSymbol, ServerCapabilities, LSPClientState, LSPClientInfo } from './lsp';

// GitHub 模块
export * from './github';

// Plugins 模块
export * from './plugins';

// Logger 模块
export * from './logger';

// Recovery 模块
export * from './recovery';

// Encoding 模块
export * from './encoding';

// 核心管理器
export class CoreManager {
  private static instance: CoreManager;
  private initialized = false;
  private modules: Map<string, { init: () => Promise<void>; destroy?: () => Promise<void> }> = new Map();

  private constructor() {}

  static getInstance(): CoreManager {
    if (!CoreManager.instance) CoreManager.instance = new CoreManager();
    return CoreManager.instance;
  }

  registerModule(name: string, module: { init: () => Promise<void>; destroy?: () => Promise<void> }): void {
    this.modules.set(name, module);
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    for (const [name, module] of this.modules) {
      try { await module.init(); console.log(`[CoreManager] ${name} initialized`); }
      catch (e) { console.error(`[CoreManager] Failed to init ${name}:`, e); }
    }
    this.initialized = true;
  }

  async destroy(): Promise<void> {
    for (const [name, module] of this.modules) {
      if (module.destroy) {
        try { await module.destroy(); console.log(`[CoreManager] ${name} destroyed`); }
        catch (e) { console.error(`[CoreManager] Failed to destroy ${name}:`, e); }
      }
    }
    this.initialized = false;
  }

  isInitialized(): boolean { return this.initialized; }
}

export const coreManager = CoreManager.getInstance();

export default { CoreManager, coreManager };
