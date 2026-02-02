/**
 * Utils - 通用工具函数库
 */

// 防抖
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounced = ((...args: Parameters<T>) => { if (timer) clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }) as T & { cancel: () => void };
  debounced.cancel = () => { if (timer) clearTimeout(timer); };
  return debounced;
}

// 节流
export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: Parameters<T>) => { const now = Date.now(); if (now - last >= ms) { last = now; fn(...args); } }) as T;
}

// 深拷贝
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(deepClone) as T;
  const clone = {} as T;
  for (const key in obj) if (Object.prototype.hasOwnProperty.call(obj, key)) (clone as any)[key] = deepClone(obj[key]);
  return clone;
}

// 深合并
export function deepMerge<T extends object>(target: T, ...sources: Partial<T>[]): T {
  for (const source of sources) {
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const targetVal = (target as any)[key], sourceVal = (source as any)[key];
        if (sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal)) {
          (target as any)[key] = deepMerge(targetVal || {}, sourceVal);
        } else { (target as any)[key] = sourceVal; }
      }
    }
  }
  return target;
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

// 格式化时间
export function formatTime(date: Date | number, format = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = typeof date === 'number' ? new Date(date) : date;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return format.replace('YYYY', d.getFullYear().toString()).replace('MM', pad(d.getMonth() + 1)).replace('DD', pad(d.getDate())).replace('HH', pad(d.getHours())).replace('mm', pad(d.getMinutes())).replace('ss', pad(d.getSeconds()));
}

// 相对时间
export function relativeTime(date: Date | number): string {
  const diff = Date.now() - (typeof date === 'number' ? date : date.getTime());
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
  return formatTime(date, 'MM-DD');
}

// 生成唯一ID
export function uuid(): string { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`; }

// 随机字符串
export function randomString(length = 8): string { return Array.from({ length }, () => Math.random().toString(36)[2]).join(''); }

// 路径处理
export const path = {
  basename: (p: string) => p.split(/[/\\]/).pop() || '',
  dirname: (p: string) => p.split(/[/\\]/).slice(0, -1).join('/') || '/',
  extname: (p: string) => { const m = p.match(/\.([^./\\]+)$/); return m ? `.${m[1]}` : ''; },
  join: (...parts: string[]) => parts.join('/').replace(/\/+/g, '/'),
  normalize: (p: string) => p.replace(/\\/g, '/').replace(/\/+/g, '/'),
};

// 文件扩展名判断
export function isImage(filename: string): boolean { return /\.(png|jpg|jpeg|gif|webp|svg|ico|bmp)$/i.test(filename); }
export function isVideo(filename: string): boolean { return /\.(mp4|webm|ogg|avi|mov|mkv)$/i.test(filename); }
export function isAudio(filename: string): boolean { return /\.(mp3|wav|ogg|flac|aac)$/i.test(filename); }
export function isCode(filename: string): boolean { return /\.(ts|tsx|js|jsx|py|rs|go|java|c|cpp|h|rb|php|cs|swift|kt)$/i.test(filename); }
export function isMarkdown(filename: string): boolean { return /\.(md|markdown)$/i.test(filename); }
export function isJson(filename: string): boolean { return /\.(json|jsonc)$/i.test(filename); }

// 获取文件语言
export function getLanguage(filename: string): string {
  const ext = path.extname(filename).toLowerCase().slice(1);
  const map: Record<string, string> = { ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact', py: 'python', rs: 'rust', go: 'go', java: 'java', c: 'c', cpp: 'cpp', h: 'c', rb: 'ruby', php: 'php', cs: 'csharp', swift: 'swift', kt: 'kotlin', md: 'markdown', json: 'json', html: 'html', css: 'css', scss: 'scss', less: 'less', sql: 'sql', sh: 'shellscript', yml: 'yaml', yaml: 'yaml', xml: 'xml' };
  return map[ext] || 'plaintext';
}

// 复制到剪贴板
export async function copyToClipboard(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

// 从剪贴板读取
export async function readFromClipboard(): Promise<string> {
  try { return await navigator.clipboard.readText(); } catch { return ''; }
}

// LRU 缓存
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  constructor(private maxSize: number) {}
  get(key: K): V | undefined { const v = this.cache.get(key); if (v !== undefined) { this.cache.delete(key); this.cache.set(key, v); } return v; }
  set(key: K, value: V): void { this.cache.delete(key); this.cache.set(key, value); if (this.cache.size > this.maxSize) this.cache.delete(this.cache.keys().next().value); }
  has(key: K): boolean { return this.cache.has(key); }
  clear(): void { this.cache.clear(); }
  get size(): number { return this.cache.size; }
}

// 事件总线
export class EventBus<T extends Record<string, any>> {
  private listeners = new Map<keyof T, Set<(data: any) => void>>();
  on<K extends keyof T>(event: K, handler: (data: T[K]) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }
  off<K extends keyof T>(event: K, handler: (data: T[K]) => void): void { this.listeners.get(event)?.delete(handler); }
  emit<K extends keyof T>(event: K, data: T[K]): void { this.listeners.get(event)?.forEach(h => h(data)); }
  clear(): void { this.listeners.clear(); }
}

// 异步队列
export class AsyncQueue {
  private queue: (() => Promise<void>)[] = [];
  private running = false;
  async add(task: () => Promise<void>): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => { try { await task(); resolve(); } catch (e) { reject(e); } });
      this.process();
    });
  }
  private async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    while (this.queue.length > 0) { const task = this.queue.shift()!; await task(); }
    this.running = false;
  }
}

// sleep
export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 重试
export async function retry<T>(fn: () => Promise<T>, attempts = 3, delay = 1000): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { if (i === attempts - 1) throw e; await sleep(delay * (i + 1)); }
  }
  throw new Error('Retry failed');
}

export default { debounce, throttle, deepClone, deepMerge, formatFileSize, formatTime, relativeTime, uuid, randomString, path, copyToClipboard, readFromClipboard, LRUCache, EventBus, AsyncQueue, sleep, retry };
