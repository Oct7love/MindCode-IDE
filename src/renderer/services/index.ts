/**
 * Services - 服务层统一导出
 */

// 补全服务
export { CompletionService, getCompletionService, createCompletionService } from './completionService';
export type { CompletionConfig, CompletionResult } from './completionService';

// 内联补全
export { registerInlineCompletionProvider } from './inlineCompletionProvider';

// 补全统计
export { CompletionStatsService, getCompletionStats } from './completionStats';

// Token 服务
export { countTokens, estimateSync as estimateTokensSync } from './tokenService';

// 服务管理器
export class ServiceManager {
  private static instance: ServiceManager;
  private services: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): ServiceManager {
    if (!ServiceManager.instance) ServiceManager.instance = new ServiceManager();
    return ServiceManager.instance;
  }

  register<T>(name: string, service: T): void { this.services.set(name, service); }
  get<T>(name: string): T | undefined { return this.services.get(name) as T; }
  has(name: string): boolean { return this.services.has(name); }
  remove(name: string): boolean { return this.services.delete(name); }
  clear(): void { this.services.clear(); }
}

export const serviceManager = ServiceManager.getInstance();

export default { ServiceManager, serviceManager };
