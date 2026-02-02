/**
 * StateSync - 多窗口/标签页状态同步
 */

export interface SyncMessage { type: string; payload: any; timestamp: number; source: string; }
type SyncHandler = (message: SyncMessage) => void;

const CHANNEL_NAME = 'mindcode-sync';

class StateSync {
  private channel: BroadcastChannel | null = null;
  private handlers = new Map<string, Set<SyncHandler>>();
  private instanceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  private enabled = typeof BroadcastChannel !== 'undefined';

  constructor() { if (this.enabled) this.init(); }

  private init(): void {
    this.channel = new BroadcastChannel(CHANNEL_NAME);
    this.channel.onmessage = (event) => {
      const message = event.data as SyncMessage;
      if (message.source === this.instanceId) return; // 忽略自己发送的消息
      this.dispatch(message);
    };
  }

  /** 发送同步消息 */
  broadcast(type: string, payload: any): void {
    if (!this.enabled || !this.channel) return;
    const message: SyncMessage = { type, payload, timestamp: Date.now(), source: this.instanceId };
    this.channel.postMessage(message);
  }

  /** 订阅消息类型 */
  on(type: string, handler: SyncHandler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.off(type, handler);
  }

  /** 取消订阅 */
  off(type: string, handler: SyncHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  /** 订阅所有消息 */
  onAny(handler: SyncHandler): () => void { return this.on('*', handler); }

  private dispatch(message: SyncMessage): void {
    this.handlers.get(message.type)?.forEach(h => h(message));
    this.handlers.get('*')?.forEach(h => h(message));
  }

  /** 同步特定状态 */
  syncState<T>(key: string, getValue: () => T, setValue: (value: T) => void): () => void {
    // 发送当前状态
    this.broadcast(`state:${key}`, getValue());
    // 监听状态变化
    return this.on(`state:${key}`, (msg) => setValue(msg.payload));
  }

  /** 请求其他窗口的状态 */
  requestState(key: string): void { this.broadcast(`request:${key}`, null); }

  /** 响应状态请求 */
  respondToRequests<T>(key: string, getValue: () => T): () => void {
    return this.on(`request:${key}`, () => this.broadcast(`state:${key}`, getValue()));
  }

  getInstanceId(): string { return this.instanceId; }
  isEnabled(): boolean { return this.enabled; }

  destroy(): void {
    this.channel?.close();
    this.handlers.clear();
  }
}

export const stateSync = new StateSync();

// ============ 常用同步类型 ============
export const SyncTypes = {
  FILE_OPENED: 'file:opened',
  FILE_CLOSED: 'file:closed',
  FILE_SAVED: 'file:saved',
  FILE_CHANGED: 'file:changed',
  SETTINGS_CHANGED: 'settings:changed',
  THEME_CHANGED: 'theme:changed',
  WORKSPACE_CHANGED: 'workspace:changed',
  GIT_STATUS: 'git:status',
} as const;

// ============ 便捷同步函数 ============
export const sync = {
  fileOpened: (path: string) => stateSync.broadcast(SyncTypes.FILE_OPENED, { path }),
  fileClosed: (path: string) => stateSync.broadcast(SyncTypes.FILE_CLOSED, { path }),
  fileSaved: (path: string) => stateSync.broadcast(SyncTypes.FILE_SAVED, { path }),
  settingsChanged: (key: string, value: any) => stateSync.broadcast(SyncTypes.SETTINGS_CHANGED, { key, value }),
  themeChanged: (theme: string) => stateSync.broadcast(SyncTypes.THEME_CHANGED, { theme }),
};

export default stateSync;
