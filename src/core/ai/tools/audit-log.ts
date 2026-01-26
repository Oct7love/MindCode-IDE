// 操作审计日志
export type AuditAction = 'tool_call' | 'file_read' | 'file_write' | 'file_delete' | 'terminal_exec' | 'mode_switch' | 'context_add' | 'message_send';
export interface AuditEntry { id: string; timestamp: number; action: AuditAction; details: Record<string, any>; user?: string; model?: string; success: boolean; error?: string; duration?: number; }

class AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries = 1000;
  private listeners: ((entry: AuditEntry) => void)[] = [];

  log(action: AuditAction, details: Record<string, any>, success = true, error?: string): AuditEntry { // 记录审计日志
    const entry: AuditEntry = { id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now(), action, details, success, error };
    if (this.entries.length >= this.maxEntries) this.entries.shift();
    this.entries.push(entry);
    this.listeners.forEach(l => l(entry));
    return entry;
  }

  async logAsync<T>(action: AuditAction, details: Record<string, any>, operation: () => Promise<T>): Promise<T> { // 异步操作日志包装
    const startTime = Date.now();
    try {
      const result = await operation();
      this.log(action, { ...details, duration: Date.now() - startTime }, true);
      return result;
    } catch (e: any) {
      this.log(action, { ...details, duration: Date.now() - startTime }, false, e.message);
      throw e;
    }
  }

  getEntries(filter?: { action?: AuditAction; since?: number; limit?: number }): AuditEntry[] { // 获取日志
    let result = [...this.entries];
    if (filter?.action) result = result.filter(e => e.action === filter.action);
    if (filter?.since) result = result.filter(e => e.timestamp >= filter.since!);
    if (filter?.limit) result = result.slice(-filter.limit);
    return result;
  }

  getStats(): { total: number; byAction: Record<AuditAction, number>; successRate: number; avgDuration: number } { // 获取统计
    const byAction = {} as Record<AuditAction, number>;
    let successCount = 0, totalDuration = 0, durationCount = 0;
    this.entries.forEach(e => {
      byAction[e.action] = (byAction[e.action] || 0) + 1;
      if (e.success) successCount++;
      if (e.duration) { totalDuration += e.duration; durationCount++; }
    });
    return { total: this.entries.length, byAction, successRate: this.entries.length ? successCount / this.entries.length : 0, avgDuration: durationCount ? totalDuration / durationCount : 0 };
  }

  subscribe(listener: (entry: AuditEntry) => void): () => void { // 订阅日志
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter(l => l !== listener); };
  }

  export(): string { return JSON.stringify(this.entries, null, 2); } // 导出日志
  clear() { this.entries = []; } // 清空日志

  formatForDisplay(entries?: AuditEntry[]): string { // 格式化显示
    const list = entries || this.entries.slice(-50);
    return list.map(e => {
      const time = new Date(e.timestamp).toLocaleTimeString();
      const status = e.success ? '✓' : '✗';
      const duration = e.duration ? `(${e.duration}ms)` : '';
      const detail = JSON.stringify(e.details).slice(0, 50);
      return `[${time}] ${status} ${e.action} ${detail}... ${duration}`;
    }).join('\n');
  }
}

export const auditLogger = new AuditLogger();

export function logToolCall(toolName: string, args: any, success: boolean, result?: any, error?: string) { // 快捷：记录工具调用
  auditLogger.log('tool_call', { tool: toolName, args, result: result ? JSON.stringify(result).slice(0, 200) : undefined }, success, error);
}

export function logFileOperation(operation: 'read' | 'write' | 'delete', path: string, success: boolean, error?: string) { // 快捷：记录文件操作
  const action = operation === 'read' ? 'file_read' : operation === 'write' ? 'file_write' : 'file_delete';
  auditLogger.log(action, { path }, success, error);
}
