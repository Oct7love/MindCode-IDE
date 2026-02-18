/**
 * 崩溃恢复机制
 * 自动保存 + 会话恢复 + 状态持久化
 * 主存储: IndexedDB（由 renderer 侧注入）
 * 降级存储: localStorage（beforeunload 同步写入）
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
  aiConversations?: unknown[];
  timestamp: number;
}

/** 异步存储后端接口（由 renderer 侧注入 IndexedDB 实现） */
export interface AsyncStorageBackend {
  get(key: string): Promise<RecoveryState | null>;
  set(key: string, value: RecoveryState): Promise<void>;
  delete(key: string): Promise<void>;
}

const STORAGE_KEY = "mindcode_recovery_state";
const AUTO_SAVE_INTERVAL = 30000; // 30 秒

class RecoveryManager {
  private state: RecoveryState | null = null;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private listeners = new Set<(state: RecoveryState) => void>();
  private initialized = false;
  private _onBeforeUnload = () => this.saveStateSync();
  private asyncBackend: AsyncStorageBackend | null = null;

  /** 注入异步存储后端（IndexedDB） */
  setAsyncBackend(backend: AsyncStorageBackend): void {
    this.asyncBackend = backend;
  }

  /** 初始化（防重复调用） */
  async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;
    await this.loadState();
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

  /** 保存状态（异步写 IndexedDB + 同步写 localStorage 降级） */
  async saveState(): Promise<void> {
    if (!this.state) return;
    this.saveStateSync();
    if (this.asyncBackend) {
      try {
        await this.asyncBackend.set(STORAGE_KEY, this.state);
      } catch (e) {
        console.warn("[Recovery] IndexedDB 写入失败:", e);
      }
    }
  }

  /** 同步写 localStorage（仅供 beforeunload） */
  private saveStateSync(): void {
    if (!this.state) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.warn("[Recovery] localStorage 写入失败:", e);
    }
  }

  /** 加载状态（优先 IndexedDB，降级 localStorage） */
  async loadState(): Promise<RecoveryState | null> {
    if (this.asyncBackend) {
      try {
        const data = await this.asyncBackend.get(STORAGE_KEY);
        if (data) {
          this.state = data;
          console.log("[Recovery] 状态已从 IndexedDB 加载");
          return this.state;
        }
      } catch (e) {
        console.warn("[Recovery] IndexedDB 读取失败:", e);
      }
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        this.state = JSON.parse(stored);
        console.log("[Recovery] 状态已从 localStorage 加载");
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
  async hasRecoverableState(): Promise<boolean> {
    const state = await this.loadState();
    if (!state) return false;
    const age = Date.now() - state.timestamp;
    return age < 24 * 60 * 60 * 1000 && (state.openFiles?.length > 0 || !!state.workspacePath);
  }

  /** 清除恢复状态 */
  async clearState(): Promise<void> {
    this.state = null;
    if (this.asyncBackend) {
      try {
        await this.asyncBackend.delete(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    console.log("[Recovery] 状态已清除");
  }

  /** 监听状态变化 */
  onStateChange(listener: (state: RecoveryState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 保存文件状态 */
  saveFileState(files: Array<{ path: string; content: string; isDirty: boolean }>): void {
    this.updateState({ openFiles: files });
  }

  /** 保存会话状态 */
  saveConversations(conversations: unknown[]): void {
    this.updateState({ aiConversations: conversations });
  }
}

export const recoveryManager = new RecoveryManager();
