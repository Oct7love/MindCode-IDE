// 性能优化模块 - 懒加载、缓存预热、启动优化
import { EventEmitter } from "events";
import { logger } from "../logger";

const startupLog = logger.child("Startup");
const preloadLog = logger.child("Preload");

// ==================== 模块懒加载器 ====================
export class LazyLoader<T> {
  private instance: T | null = null;
  private loading: Promise<T> | null = null;
  private factory: () => Promise<T>;

  constructor(factory: () => Promise<T>) {
    this.factory = factory;
  }

  async get(): Promise<T> {
    if (this.instance) return this.instance;
    if (this.loading) return this.loading;
    this.loading = this.factory().then((inst) => {
      this.instance = inst;
      return inst;
    });
    return this.loading;
  }

  isLoaded(): boolean {
    return this.instance !== null;
  }
  preload(): void {
    if (!this.instance && !this.loading) this.get();
  } // 后台预加载
}

// ==================== 启动性能追踪 ====================
export class StartupTracker extends EventEmitter {
  private marks: Map<string, number> = new Map();
  private measures: Map<string, number> = new Map();
  private startTime = Date.now();

  mark(name: string): void {
    this.marks.set(name, Date.now() - this.startTime);
  }

  measure(name: string, start: string, end?: string): number {
    const startMs = this.marks.get(start) ?? 0;
    const endMs = end
      ? (this.marks.get(end) ?? Date.now() - this.startTime)
      : Date.now() - this.startTime;
    const duration = endMs - startMs;
    this.measures.set(name, duration);
    return duration;
  }

  getReport(): {
    marks: Record<string, number>;
    measures: Record<string, number>;
    totalMs: number;
  } {
    return {
      marks: Object.fromEntries(this.marks),
      measures: Object.fromEntries(this.measures),
      totalMs: Date.now() - this.startTime,
    };
  }

  log(): void {
    const report = this.getReport();
    startupLog.info(`总耗时: ${report.totalMs}ms`);
    for (const [name, ms] of Object.entries(report.measures)) startupLog.info(`  ${name}: ${ms}ms`);
  }
}

// ==================== 请求管道优化 ====================
export class RequestPipeline {
  private pending: Map<string, Promise<any>> = new Map();
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheMaxAge: number;

  constructor(cacheMaxAgeMs = 5000) {
    this.cacheMaxAge = cacheMaxAgeMs;
  }

  async dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    // 去重相同请求
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) return cached.data as T;
    if (this.pending.has(key)) return this.pending.get(key) as Promise<T>;
    const promise = fn()
      .then((data) => {
        this.cache.set(key, { data, timestamp: Date.now() });
        this.pending.delete(key);
        return data;
      })
      .catch((err) => {
        this.pending.delete(key);
        throw err;
      });
    this.pending.set(key, promise);
    return promise;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }
  clear(): void {
    this.cache.clear();
  }
}

// ==================== 补全缓存预热 ====================
export class CompletionCache {
  private cache: Map<string, { result: string; timestamp: number; hits: number }> = new Map();
  private patterns: Map<string, number> = new Map(); // 常用模式计数
  private maxSize = 1000;
  private ttl = 30000; // 30秒

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    entry.hits++;
    return entry.result;
  }

  set(key: string, result: string): void {
    if (this.cache.size >= this.maxSize) this.evict();
    this.cache.set(key, { result, timestamp: Date.now(), hits: 1 });
    this.recordPattern(key);
  }

  private evict(): void {
    // LRU + 低命中清理
    const entries = [...this.cache.entries()].sort((a, b) => a[1].hits - b[1].hits);
    const toRemove = Math.ceil(entries.length * 0.2);
    for (let i = 0; i < toRemove; i++) this.cache.delete(entries[i][0]);
  }

  private recordPattern(key: string): void {
    const pattern = this.extractPattern(key);
    this.patterns.set(pattern, (this.patterns.get(pattern) ?? 0) + 1);
  }

  private extractPattern(key: string): string {
    // 提取代码模式（简化）
    return key
      .replace(/\d+/g, "N")
      .replace(/['"][^'"]*['"]/g, "STR")
      .slice(0, 100);
  }

  getHotPatterns(limit = 10): string[] {
    return [...this.patterns.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([p]) => p);
  }

  getStats(): { size: number; hotPatterns: number } {
    return { size: this.cache.size, hotPatterns: this.patterns.size };
  }
}

// ==================== 模块预加载调度器 ====================
export class PreloadScheduler {
  private queue: Array<{ name: string; fn: () => Promise<void>; priority: number }> = [];
  private running = false;
  private completed: Set<string> = new Set();

  schedule(name: string, fn: () => Promise<void>, priority = 0): void {
    if (this.completed.has(name)) return;
    this.queue.push({ name, fn, priority });
    this.queue.sort((a, b) => b.priority - a.priority);
    if (!this.running) this.run();
  }

  private async run(): Promise<void> {
    this.running = true;
    while (this.queue.length > 0) {
      const task = this.queue.shift()!;
      try {
        await task.fn();
        this.completed.add(task.name);
        preloadLog.info(`${task.name} 完成`);
      } catch (err) {
        preloadLog.error(`${task.name} 失败`, err);
      }
      await new Promise((r) => setTimeout(r, 10)); // 避免阻塞主线程
    }
    this.running = false;
  }

  isCompleted(name: string): boolean {
    return this.completed.has(name);
  }
}

// ==================== 全局实例 ====================
export const startupTracker = new StartupTracker();
export const requestPipeline = new RequestPipeline();
export const completionCache = new CompletionCache();
export const preloadScheduler = new PreloadScheduler();

// 启动入口点标记
export function markStartup(point: string): void {
  startupTracker.mark(point);
}
export function logStartupReport(): void {
  startupTracker.log();
}
