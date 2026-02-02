/**
 * AutoSave - 自动保存服务
 */

export interface AutoSaveConfig { enabled: boolean; delay: number; onFocusLoss: boolean; onWindowClose: boolean; }
type SaveHandler = (path: string, content: string) => Promise<void>;

const STORAGE_KEY = 'mindcode-autosave-config';
const DRAFT_PREFIX = 'mindcode-draft-';

class AutoSaveService {
  private config: AutoSaveConfig = { enabled: true, delay: 1000, onFocusLoss: true, onWindowClose: true };
  private timers = new Map<string, NodeJS.Timeout>();
  private dirtyFiles = new Map<string, { content: string; lastModified: number }>();
  private saveHandler: SaveHandler | null = null;
  private initialized = false;

  init(saveHandler: SaveHandler): void {
    if (this.initialized) return;
    this.saveHandler = saveHandler;
    this.loadConfig();
    this.setupListeners();
    this.initialized = true;
  }

  private setupListeners(): void {
    window.addEventListener('blur', () => { if (this.config.onFocusLoss) this.saveAll(); });
    window.addEventListener('beforeunload', () => { if (this.config.onWindowClose) this.saveAllSync(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.config.onFocusLoss) this.saveAll(); });
  }

  /** 标记文件为脏 */
  markDirty(path: string, content: string): void {
    this.dirtyFiles.set(path, { content, lastModified: Date.now() });
    this.saveDraft(path, content);

    if (!this.config.enabled) return;

    // 取消之前的定时器
    const existingTimer = this.timers.get(path);
    if (existingTimer) clearTimeout(existingTimer);

    // 设置新的定时器
    const timer = setTimeout(() => this.save(path), this.config.delay);
    this.timers.set(path, timer);
  }

  /** 标记文件为干净 */
  markClean(path: string): void {
    this.dirtyFiles.delete(path);
    const timer = this.timers.get(path);
    if (timer) { clearTimeout(timer); this.timers.delete(path); }
    this.clearDraft(path);
  }

  /** 保存单个文件 */
  async save(path: string): Promise<boolean> {
    const dirty = this.dirtyFiles.get(path);
    if (!dirty || !this.saveHandler) return false;

    try {
      await this.saveHandler(path, dirty.content);
      this.markClean(path);
      console.log('[AutoSave] Saved:', path);
      return true;
    } catch (e) { console.error('[AutoSave] Save failed:', path, e); return false; }
  }

  /** 保存所有脏文件 */
  async saveAll(): Promise<void> {
    const paths = Array.from(this.dirtyFiles.keys());
    await Promise.all(paths.map(p => this.save(p)));
  }

  /** 同步保存所有（用于 beforeunload） */
  private saveAllSync(): void {
    for (const [path, dirty] of this.dirtyFiles) {
      this.saveDraft(path, dirty.content); // 至少保存草稿
    }
  }

  /** 检查是否有未保存的更改 */
  hasDirtyFiles(): boolean { return this.dirtyFiles.size > 0; }
  getDirtyFiles(): string[] { return Array.from(this.dirtyFiles.keys()); }
  isDirty(path: string): boolean { return this.dirtyFiles.has(path); }

  // ============ 草稿管理 ============

  private saveDraft(path: string, content: string): void {
    try { localStorage.setItem(DRAFT_PREFIX + this.hashPath(path), JSON.stringify({ path, content, timestamp: Date.now() })); }
    catch { /* quota exceeded */ }
  }

  private clearDraft(path: string): void {
    localStorage.removeItem(DRAFT_PREFIX + this.hashPath(path));
  }

  getDraft(path: string): { content: string; timestamp: number } | null {
    try {
      const stored = localStorage.getItem(DRAFT_PREFIX + this.hashPath(path));
      if (stored) { const data = JSON.parse(stored); return { content: data.content, timestamp: data.timestamp }; }
    } catch {}
    return null;
  }

  listDrafts(): { path: string; timestamp: number }[] {
    const drafts: { path: string; timestamp: number }[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) {
        try { const data = JSON.parse(localStorage.getItem(key)!); drafts.push({ path: data.path, timestamp: data.timestamp }); }
        catch {}
      }
    }
    return drafts.sort((a, b) => b.timestamp - a.timestamp);
  }

  clearAllDrafts(): void {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }

  private hashPath(path: string): string {
    let hash = 0;
    for (let i = 0; i < path.length; i++) { hash = ((hash << 5) - hash) + path.charCodeAt(i); hash |= 0; }
    return hash.toString(36);
  }

  // ============ 配置 ============

  getConfig(): AutoSaveConfig { return { ...this.config }; }

  setConfig(updates: Partial<AutoSaveConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveConfig();
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) this.config = { ...this.config, ...JSON.parse(stored) };
    } catch {}
  }

  private saveConfig(): void {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.config)); }
    catch {}
  }

  destroy(): void {
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
    this.dirtyFiles.clear();
  }
}

export const autoSave = new AutoSaveService();
export default autoSave;
