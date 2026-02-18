/**
 * 崩溃恢复机制
 * 自动保存 + 会话恢复 + 状态持久化
 */

export interface RecoveryState {
  openFiles: Array<{
    path: string;
    content: string;
    isDirty: boolean;
    cursorPosition?: { line: number; column: number };
  }>;
  activeFileId?: string;
  workspacePath?: string;
  aiConversations?: any[];
  timestamp: number;
}

const STORAGE_KEY = "mindcode_recovery_state";
const AUTO_SAVE_INTERVAL = 30000; // 30 秒

class RecoveryManager {
  private state: RecoveryState | null = null;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(state: RecoveryState) => void>();
  private initialized = false;
  private _onBeforeUnload = () => this.saveState();

  /** 初始化（防重复调用） */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.loadState();
    this.startAutoSave();
    window.addEventListener("beforeunload", this._onBeforeUnload);
    console.log("[Recovery] 初始化完成");
  }

  /** 销毁，释放监听器和定时器 */
  destroy(): void {
    window.removeEventListener("beforeunload", this._onBeforeUnload);
    this.stopAutoSave();
    this.listeners.clear();
    this.initialized = false;
  }

  /** 开始自动保存 */
  startAutoSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setInterval(() => this.saveState(), AUTO_SAVE_INTERVAL);
  }

  /** 停止自动保存 */
  stopAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
  }

  /** 更新状态 */
  updateState(partial: Partial<RecoveryState>): void {
    this.state = { ...this.state, ...partial, timestamp: Date.now() } as RecoveryState;
  }

  /** 保存状态到 localStorage */
  saveState(): void {
    if (!this.state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      console.log("[Recovery] 状态已保存");
    } catch (e) {
      console.error("[Recovery] 保存失败:", e);
    }
  }

  /** 加载状态 */
  loadState(): RecoveryState | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.state = JSON.parse(stored);
        console.log("[Recovery] 状态已加载");
        return this.state;
      }
    } catch (e) {
      console.error("[Recovery] 加载失败:", e);
    }
    return null;
  }

  /** 获取当前状态 */
  getState(): RecoveryState | null {
    return this.state;
  }

  /** 检查是否有可恢复的状态 */
  hasRecoverableState(): boolean {
    const state = this.loadState();
    if (!state) return false;
    const age = Date.now() - state.timestamp;
    return age < 24 * 60 * 60 * 1000 && (state.openFiles?.length > 0 || !!state.workspacePath); // 24 小时内
  }

  /** 清除恢复状态 */
  clearState(): void {
    this.state = null;
    localStorage.removeItem(STORAGE_KEY);
    console.log("[Recovery] 状态已清除");
  }

  /** 监听状态变化 */
  onStateChange(listener: (state: RecoveryState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 保存文件状态（用于编辑器调用） */
  saveFileState(files: Array<{ path: string; content: string; isDirty: boolean }>): void {
    this.updateState({ openFiles: files });
  }

  /** 保存会话状态（用于 AI 对话） */
  saveConversations(conversations: any[]): void {
    this.updateState({ aiConversations: conversations });
  }
}

export const recoveryManager = new RecoveryManager();
