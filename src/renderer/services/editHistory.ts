/**
 * EditHistory - 编辑历史管理
 */

export interface EditOperation { type: 'insert' | 'delete' | 'replace'; offset: number; length: number; text: string; oldText?: string; timestamp: number; }
export interface HistoryState { content: string; timestamp: number; description?: string; }

class EditHistory {
  private histories = new Map<string, { undoStack: HistoryState[]; redoStack: HistoryState[]; current: string }>();
  private maxHistory = 100;

  /** 初始化文件历史 */
  init(path: string, content: string): void {
    this.histories.set(path, { undoStack: [], redoStack: [], current: content });
  }

  /** 记录更改 */
  push(path: string, content: string, description?: string): void {
    const history = this.histories.get(path);
    if (!history) { this.init(path, content); return; }
    if (history.current === content) return; // 无变化

    history.undoStack.push({ content: history.current, timestamp: Date.now(), description });
    if (history.undoStack.length > this.maxHistory) history.undoStack.shift();
    history.current = content;
    history.redoStack = []; // 新操作清空 redo 栈
  }

  /** 撤销 */
  undo(path: string): string | null {
    const history = this.histories.get(path);
    if (!history || history.undoStack.length === 0) return null;

    const prev = history.undoStack.pop()!;
    history.redoStack.push({ content: history.current, timestamp: Date.now() });
    history.current = prev.content;
    return prev.content;
  }

  /** 重做 */
  redo(path: string): string | null {
    const history = this.histories.get(path);
    if (!history || history.redoStack.length === 0) return null;

    const next = history.redoStack.pop()!;
    history.undoStack.push({ content: history.current, timestamp: Date.now() });
    history.current = next.content;
    return next.content;
  }

  /** 检查是否可撤销/重做 */
  canUndo(path: string): boolean { return (this.histories.get(path)?.undoStack.length || 0) > 0; }
  canRedo(path: string): boolean { return (this.histories.get(path)?.redoStack.length || 0) > 0; }

  /** 获取历史列表 */
  getHistory(path: string): HistoryState[] { return this.histories.get(path)?.undoStack || []; }

  /** 跳转到指定历史版本 */
  goto(path: string, index: number): string | null {
    const history = this.histories.get(path);
    if (!history || index < 0 || index >= history.undoStack.length) return null;

    // 保存当前状态到 redo
    history.redoStack.push({ content: history.current, timestamp: Date.now() });
    // 移动指定位置之后的历史到 redo
    const toMove = history.undoStack.splice(index);
    toMove.forEach(s => history.redoStack.push(s));
    // 恢复目标版本
    const target = history.undoStack.pop()!;
    history.current = target.content;
    return target.content;
  }

  /** 清除历史 */
  clear(path: string): void { this.histories.delete(path); }
  clearAll(): void { this.histories.clear(); }

  /** 获取当前内容 */
  getCurrent(path: string): string | undefined { return this.histories.get(path)?.current; }

  /** 设置最大历史数 */
  setMaxHistory(max: number): void { this.maxHistory = max; }
}

export const editHistory = new EditHistory();

// ============ 文件版本管理 ============

export interface FileVersion { id: string; path: string; content: string; timestamp: number; label?: string; auto?: boolean; }

const VERSION_PREFIX = 'mindcode-version-';
const MAX_VERSIONS = 20;

class FileVersionManager {
  /** 保存版本 */
  saveVersion(path: string, content: string, label?: string, auto = false): string {
    const id = `v-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const version: FileVersion = { id, path, content, timestamp: Date.now(), label, auto };

    const versions = this.getVersions(path);
    versions.unshift(version);

    // 限制版本数量（保留手动版本，优先删除自动版本）
    if (versions.length > MAX_VERSIONS) {
      const autoVersions = versions.filter(v => v.auto);
      if (autoVersions.length > 5) {
        const toRemove = autoVersions.slice(5);
        toRemove.forEach(v => this.deleteVersion(path, v.id));
      }
    }

    this.saveVersions(path, versions.slice(0, MAX_VERSIONS));
    return id;
  }

  /** 获取版本列表 */
  getVersions(path: string): FileVersion[] {
    try {
      const stored = localStorage.getItem(VERSION_PREFIX + this.hashPath(path));
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  }

  /** 获取指定版本 */
  getVersion(path: string, versionId: string): FileVersion | null {
    return this.getVersions(path).find(v => v.id === versionId) || null;
  }

  /** 删除版本 */
  deleteVersion(path: string, versionId: string): void {
    const versions = this.getVersions(path).filter(v => v.id !== versionId);
    this.saveVersions(path, versions);
  }

  /** 恢复版本 */
  restoreVersion(path: string, versionId: string): string | null {
    const version = this.getVersion(path, versionId);
    return version?.content || null;
  }

  /** 比较版本 */
  compareVersions(path: string, id1: string, id2: string): { v1: FileVersion | null; v2: FileVersion | null } {
    const versions = this.getVersions(path);
    return { v1: versions.find(v => v.id === id1) || null, v2: versions.find(v => v.id === id2) || null };
  }

  /** 清除文件所有版本 */
  clearVersions(path: string): void { localStorage.removeItem(VERSION_PREFIX + this.hashPath(path)); }

  private saveVersions(path: string, versions: FileVersion[]): void {
    try { localStorage.setItem(VERSION_PREFIX + this.hashPath(path), JSON.stringify(versions)); }
    catch { /* quota exceeded */ }
  }

  private hashPath(path: string): string {
    let hash = 0;
    for (let i = 0; i < path.length; i++) { hash = ((hash << 5) - hash) + path.charCodeAt(i); hash |= 0; }
    return hash.toString(36);
  }
}

export const fileVersionManager = new FileVersionManager();

export default { editHistory, fileVersionManager };
