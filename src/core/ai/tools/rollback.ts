// 文件变更回滚机制
export interface ChangeRecord { id: string; timestamp: number; path: string; originalContent: string; newContent: string; operation: 'write' | 'delete' | 'rename'; oldPath?: string; }
export interface RollbackSession { sessionId: string; startTime: number; changes: ChangeRecord[]; }

class RollbackManager {
  private sessions: Map<string, RollbackSession> = new Map();
  private currentSessionId: string | null = null;
  private maxRecordsPerSession = 100;
  private maxSessions = 10;

  startSession(): string { // 开始新的回滚会话
    const sessionId = `session-${Date.now()}`;
    if (this.sessions.size >= this.maxSessions) { // 清理旧会话
      const oldest = Array.from(this.sessions.entries()).sort((a, b) => a[1].startTime - b[1].startTime)[0];
      if (oldest) this.sessions.delete(oldest[0]);
    }
    this.sessions.set(sessionId, { sessionId, startTime: Date.now(), changes: [] });
    this.currentSessionId = sessionId;
    return sessionId;
  }

  recordChange(change: Omit<ChangeRecord, 'id' | 'timestamp'>): string | null { // 记录变更
    const session = this.currentSessionId ? this.sessions.get(this.currentSessionId) : null;
    if (!session) return null;
    if (session.changes.length >= this.maxRecordsPerSession) session.changes.shift(); // 限制数量
    const record: ChangeRecord = { ...change, id: `change-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: Date.now() };
    session.changes.push(record);
    return record.id;
  }

  async rollback(changeId: string): Promise<{ success: boolean; error?: string }> { // 回滚单个变更
    for (const session of this.sessions.values()) {
      const change = session.changes.find(c => c.id === changeId);
      if (change) {
        try {
          if (change.operation === 'write') await (window as any).mindcode?.fs?.writeFile?.(change.path, change.originalContent);
          else if (change.operation === 'delete') await (window as any).mindcode?.fs?.writeFile?.(change.path, change.originalContent);
          else if (change.operation === 'rename' && change.oldPath) await (window as any).mindcode?.fs?.rename?.(change.path, change.oldPath);
          session.changes = session.changes.filter(c => c.id !== changeId);
          return { success: true };
        } catch (e: any) { return { success: false, error: e.message }; }
      }
    }
    return { success: false, error: '未找到变更记录' };
  }

  async rollbackSession(sessionId: string): Promise<{ success: boolean; rolled: number; failed: number }> { // 回滚整个会话
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, rolled: 0, failed: 0 };
    let rolled = 0, failed = 0;
    for (const change of [...session.changes].reverse()) { // 逆序回滚
      const result = await this.rollback(change.id);
      result.success ? rolled++ : failed++;
    }
    if (failed === 0) this.sessions.delete(sessionId);
    return { success: failed === 0, rolled, failed };
  }

  getSessionChanges(sessionId?: string): ChangeRecord[] { // 获取会话变更
    const sid = sessionId || this.currentSessionId;
    return sid ? this.sessions.get(sid)?.changes || [] : [];
  }

  getAllSessions(): RollbackSession[] { return Array.from(this.sessions.values()); }
  getCurrentSessionId(): string | null { return this.currentSessionId; }
  endSession() { this.currentSessionId = null; }
}

export const rollbackManager = new RollbackManager();

export async function withRollback<T>(operation: () => Promise<T>, onError?: (e: Error) => void): Promise<T | null> { // 带回滚的操作包装器
  const sessionId = rollbackManager.startSession();
  try {
    const result = await operation();
    rollbackManager.endSession();
    return result;
  } catch (e: any) {
    onError?.(e);
    await rollbackManager.rollbackSession(sessionId);
    return null;
  }
}
