/**
 * 命令注册表
 * 管理所有插件和内置命令
 */

import type { Disposable } from './types';

export type CommandHandler = (...args: any[]) => any | Promise<any>;

export interface CommandInfo { id: string; handler: CommandHandler; title?: string; category?: string; source: 'builtin' | string; }

export class CommandRegistry {
  private commands = new Map<string, CommandInfo>();
  private listeners = new Set<(commands: CommandInfo[]) => void>();

  /** 注册命令 */
  registerCommand(id: string, handler: CommandHandler, options?: { title?: string; category?: string; source?: string }): Disposable {
    if (this.commands.has(id)) console.warn(`[CommandRegistry] 命令已存在，覆盖: ${id}`);
    const info: CommandInfo = { id, handler, title: options?.title, category: options?.category, source: options?.source || 'builtin' };
    this.commands.set(id, info);
    this.notifyListeners();
    return { dispose: () => { this.commands.delete(id); this.notifyListeners(); } };
  }

  /** 执行命令 */
  async executeCommand(id: string, ...args: any[]): Promise<any> {
    const info = this.commands.get(id);
    if (!info) { console.error(`[CommandRegistry] 命令未找到: ${id}`); throw new Error(`Command not found: ${id}`); }
    return await info.handler(...args);
  }

  /** 检查命令是否存在 */
  hasCommand(id: string): boolean { return this.commands.has(id); }

  /** 获取命令信息 */
  getCommand(id: string): CommandInfo | undefined { return this.commands.get(id); }

  /** 列出所有命令 */
  listCommands(): CommandInfo[] { return Array.from(this.commands.values()); }

  /** 按来源筛选命令 */
  listCommandsBySource(source: string): CommandInfo[] { return this.listCommands().filter(c => c.source === source); }

  /** 监听命令变化 */
  onCommandsChanged(listener: (commands: CommandInfo[]) => void): Disposable {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  }

  private notifyListeners(): void { const commands = this.listCommands(); this.listeners.forEach(l => l(commands)); }
}

// 全局单例
let _registry: CommandRegistry | null = null;
export function getCommandRegistry(): CommandRegistry { if (!_registry) _registry = new CommandRegistry(); return _registry; }
