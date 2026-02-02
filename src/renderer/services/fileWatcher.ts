/**
 * FileWatcher - 文件监控服务
 */

export interface FileChangeEvent { type: 'create' | 'change' | 'delete' | 'rename'; path: string; oldPath?: string; }
type FileChangeHandler = (event: FileChangeEvent) => void;

const win = window as any;

class FileWatcher {
  private watchers = new Map<string, { path: string; handlers: Set<FileChangeHandler> }>();
  private globalHandlers = new Set<FileChangeHandler>();
  private pollInterval = 2000;
  private pollTimers = new Map<string, NodeJS.Timeout>();

  /** 监控文件变化 */
  watch(path: string, handler: FileChangeHandler): () => void {
    if (!this.watchers.has(path)) {
      this.watchers.set(path, { path, handlers: new Set() });
      this.startWatching(path);
    }
    this.watchers.get(path)!.handlers.add(handler);
    return () => this.unwatch(path, handler);
  }

  /** 取消监控 */
  unwatch(path: string, handler?: FileChangeHandler): void {
    const watcher = this.watchers.get(path);
    if (!watcher) return;
    if (handler) { watcher.handlers.delete(handler); if (watcher.handlers.size === 0) this.stopWatching(path); }
    else this.stopWatching(path);
  }

  /** 全局监控 */
  onAnyChange(handler: FileChangeHandler): () => void {
    this.globalHandlers.add(handler);
    return () => this.globalHandlers.delete(handler);
  }

  private async startWatching(path: string): Promise<void> {
    // 使用 IPC 注册文件监控
    if (win.mindcode?.fs?.watch) {
      try {
        await win.mindcode.fs.watch(path, (event: FileChangeEvent) => this.emit(event));
        return;
      } catch (e) { console.warn('[FileWatcher] IPC watch failed, using polling:', e); }
    }

    // 回退到轮询模式
    let lastMtime = await this.getFileMtime(path);
    const timer = setInterval(async () => {
      const currentMtime = await this.getFileMtime(path);
      if (currentMtime !== lastMtime) {
        lastMtime = currentMtime;
        this.emit({ type: currentMtime ? 'change' : 'delete', path });
      }
    }, this.pollInterval);
    this.pollTimers.set(path, timer);
  }

  private stopWatching(path: string): void {
    this.watchers.delete(path);
    const timer = this.pollTimers.get(path);
    if (timer) { clearInterval(timer); this.pollTimers.delete(path); }
    if (win.mindcode?.fs?.unwatch) win.mindcode.fs.unwatch(path).catch(() => {});
  }

  private async getFileMtime(path: string): Promise<number | null> {
    try {
      if (win.mindcode?.fs?.stat) { const stat = await win.mindcode.fs.stat(path); return stat?.mtime || null; }
    } catch { return null; }
    return null;
  }

  private emit(event: FileChangeEvent): void {
    const watcher = this.watchers.get(event.path);
    if (watcher) watcher.handlers.forEach(h => h(event));
    this.globalHandlers.forEach(h => h(event));
  }

  /** 检查文件是否被外部修改 */
  async checkExternalChange(path: string, knownMtime: number): Promise<boolean> {
    const currentMtime = await this.getFileMtime(path);
    return currentMtime !== null && currentMtime !== knownMtime;
  }

  destroy(): void {
    this.pollTimers.forEach(timer => clearInterval(timer));
    this.pollTimers.clear();
    this.watchers.clear();
    this.globalHandlers.clear();
  }
}

export const fileWatcher = new FileWatcher();
export default fileWatcher;
