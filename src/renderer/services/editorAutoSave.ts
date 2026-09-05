/**
 * 按 fileId 调度自动保存。定时器捕获 id/path/generation，避免切 tab 写错文件。
 */
export interface AutoSaveTarget {
  fileId: string;
  path: string;
  content: string;
  generation: number;
}

export interface AutoSaveDeps {
  delayMs: number;
  isEnabled: () => boolean;
  getFile: (fileId: string) => { path: string; content: string; generation: number; isUntitled?: boolean; isPreview?: boolean } | undefined;
  save: (fileId: string, path: string, content: string) => Promise<boolean>;
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancel?: (id: ReturnType<typeof setTimeout>) => void;
}

export class EditorAutoSave {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private inflight = new Set<string>();
  private readonly scheduleFn: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  private readonly cancelFn: (id: ReturnType<typeof setTimeout>) => void;

  constructor(private deps: AutoSaveDeps) {
    this.scheduleFn = deps.schedule ?? setTimeout;
    this.cancelFn = deps.cancel ?? clearTimeout;
  }

  noteEdit(target: AutoSaveTarget): void {
    this.cancel(target.fileId);
    if (!this.deps.isEnabled()) return;
    if (target.path === "" || target.content === undefined) return;
    const handle = this.scheduleFn(() => {
      void this.flush(target.fileId);
    }, this.deps.delayMs);
    this.timers.set(target.fileId, handle);
  }

  cancel(fileId: string): void {
    const handle = this.timers.get(fileId);
    if (handle !== undefined) {
      this.cancelFn(handle);
      this.timers.delete(fileId);
    }
  }

  cancelAll(): void {
    for (const id of [...this.timers.keys()]) this.cancel(id);
  }

  async flush(fileId: string): Promise<boolean> {
    this.cancel(fileId);
    const file = this.deps.getFile(fileId);
    if (!file || file.isUntitled || file.isPreview) return false;
    if (this.inflight.has(fileId)) return false;
    this.inflight.add(fileId);
    const snapshot = { path: file.path, content: file.content, generation: file.generation };
    try {
      const latest = this.deps.getFile(fileId);
      if (!latest || latest.path !== snapshot.path) return false;
      if (latest.generation !== snapshot.generation) {
        this.noteEdit({ fileId, ...latest });
        return false;
      }
      const ok = await this.deps.save(fileId, snapshot.path, snapshot.content);
      const after = this.deps.getFile(fileId);
      if (ok && after && after.generation !== snapshot.generation) {
        this.noteEdit({ fileId, ...after });
      }
      return ok;
    } finally {
      this.inflight.delete(fileId);
    }
  }
}
