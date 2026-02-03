/**
 * 补全缓存系统 - 极速版
 * 多级缓存：精确缓存 + 模糊缓存 + 前缀缓存
 */

interface CacheEntry { completion: string; timestamp: number; model: string; score: number; }

export class CompletionCache {
  private exact = new Map<string, CacheEntry>(); // 精确缓存 (完整上下文)
  private fuzzy = new Map<string, CacheEntry>(); // 模糊缓存 (行级别)
  private prefix = new Map<string, CacheEntry>(); // 前缀缓存 (触发字符)
  private maxSize: number;
  private ttl: number;

  constructor(maxSize = 500, ttl = 60000) { this.maxSize = maxSize; this.ttl = ttl; }

  /** 生成精确 key */
  exactKey(filePath: string, line: number, col: number, prefix: string): string {
    return `${filePath}:${line}:${col}:${prefix.slice(-100)}`;
  }

  /** 生成模糊 key (忽略列位置) */
  fuzzyKey(filePath: string, line: number, lineContent: string): string {
    return `${filePath}:${line}:${lineContent.trim().slice(0, 50)}`;
  }

  /** 生成前缀 key (基于触发字符) */
  prefixKey(filePath: string, line: number, trigger: string): string {
    return `${filePath}:${line}:trigger:${trigger}`;
  }

  /** 获取缓存 (按优先级) */
  get(filePath: string, line: number, col: number, prefix: string, lineContent: string): CacheEntry | null {
    const now = Date.now();
    // 1. 精确匹配
    const exactK = this.exactKey(filePath, line, col, prefix);
    const exact = this.exact.get(exactK);
    if (exact && now - exact.timestamp < this.ttl) { this.touch(this.exact, exactK, exact); return { ...exact, score: 1.0 }; }
    // 2. 模糊匹配 (同一行)
    const fuzzyK = this.fuzzyKey(filePath, line, lineContent);
    const fuzzy = this.fuzzy.get(fuzzyK);
    if (fuzzy && now - fuzzy.timestamp < this.ttl) {
      if (this.isCompletionApplicable(fuzzy.completion, prefix)) { this.touch(this.fuzzy, fuzzyK, fuzzy); return { ...fuzzy, score: 0.8 }; }
    }
    // 3. 前缀匹配 (触发字符)
    const trigger = prefix.slice(-1);
    if (['.', '(', '[', '{', ':', '/', '<'].includes(trigger)) {
      const prefixK = this.prefixKey(filePath, line, trigger);
      const prefixEntry = this.prefix.get(prefixK);
      if (prefixEntry && now - prefixEntry.timestamp < this.ttl) { return { ...prefixEntry, score: 0.5 }; }
    }
    return null;
  }

  /** 检查补全是否仍然适用 */
  private isCompletionApplicable(completion: string, currentPrefix: string): boolean {
    if (!completion) return false;
    const typed = currentPrefix.slice(-10);
    return completion.includes(typed) || typed.endsWith(completion.slice(0, 5));
  }

  /** 设置缓存 */
  set(filePath: string, line: number, col: number, prefix: string, lineContent: string, completion: string, model: string): void {
    const entry: CacheEntry = { completion, timestamp: Date.now(), model, score: 1.0 };
    this.exactPut(this.exactKey(filePath, line, col, prefix), entry);
    this.fuzzyPut(this.fuzzyKey(filePath, line, lineContent), entry);
    const trigger = prefix.slice(-1);
    if (['.', '(', '[', '{', ':', '/', '<'].includes(trigger)) {
      this.prefixPut(this.prefixKey(filePath, line, trigger), entry);
    }
  }

  private exactPut(key: string, entry: CacheEntry): void { this.evict(this.exact); this.exact.set(key, entry); }
  private fuzzyPut(key: string, entry: CacheEntry): void { this.evict(this.fuzzy); this.fuzzy.set(key, entry); }
  private prefixPut(key: string, entry: CacheEntry): void { this.evict(this.prefix); this.prefix.set(key, entry); }

  private touch(map: Map<string, CacheEntry>, key: string, entry: CacheEntry): void {
    map.delete(key);
    map.set(key, entry);
  }

  private evict(map: Map<string, CacheEntry>): void {
    if (map.size >= this.maxSize) {
      const first = map.keys().next().value;
      if (first) map.delete(first);
    }
  }

  /** 预热缓存 (基于最近编辑位置) */
  warmup(entries: Array<{ filePath: string; line: number; col: number; prefix: string; lineContent: string; completion: string; model: string }>): void {
    for (const e of entries) this.set(e.filePath, e.line, e.col, e.prefix, e.lineContent, e.completion, e.model);
  }

  /** 清空 */
  clear(): void { this.exact.clear(); this.fuzzy.clear(); this.prefix.clear(); }

  /** 统计 */
  stats(): { exact: number; fuzzy: number; prefix: number } {
    return { exact: this.exact.size, fuzzy: this.fuzzy.size, prefix: this.prefix.size };
  }
}

export const completionCache = new CompletionCache();
export default completionCache;
