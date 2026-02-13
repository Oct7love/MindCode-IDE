/**
 * Cache Manager - 缓存管理系统
 */

interface CacheItem<T> {
  value: T;
  expires: number;
  hits: number;
  created: number;
}
interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

class CacheManager<T = unknown> {
  private cache = new Map<string, CacheItem<T>>();
  private maxSize: number;
  private defaultTTL: number;
  private hits = 0;
  private misses = 0;

  constructor(maxSize = 500, defaultTTL = 300000) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  set(key: string, value: T, ttl?: number): void {
    if (this.cache.size >= this.maxSize) this.evict();
    this.cache.set(key, {
      value,
      expires: Date.now() + (ttl ?? this.defaultTTL),
      hits: 0,
      created: Date.now(),
    });
  }

  get(key: string): T | undefined {
    const item = this.cache.get(key);
    if (!item) {
      this.misses++;
      return undefined;
    }
    if (item.expires < Date.now()) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    item.hits++;
    this.hits++;
    return item.value;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);
    return !!item && item.expires >= Date.now();
  }
  delete(key: string): boolean {
    return this.cache.delete(key);
  }
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  getOrSet(key: string, factory: () => T, ttl?: number): T {
    // 获取或设置
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = factory();
    this.set(key, value, ttl);
    return value;
  }

  async getOrSetAsync(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    // 异步获取或设置
    const cached = this.get(key);
    if (cached !== undefined) return cached;
    const value = await factory();
    this.set(key, value, ttl);
    return value;
  }

  private evict(): void {
    // LRU 淘汰
    let oldest: string | null = null;
    let oldestTime = Infinity;
    for (const [key, item] of this.cache) {
      if (item.expires < Date.now()) {
        this.cache.delete(key);
        return;
      }
      const score = item.created + item.hits * 60000; // 考虑命中次数
      if (score < oldestTime) {
        oldest = key;
        oldestTime = score;
      }
    }
    if (oldest) this.cache.delete(oldest);
  }

  prune(): number {
    // 清理过期
    let count = 0;
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (item.expires < now) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  getStats(): CacheStats {
    // 统计信息
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }

  keys(): string[] {
    return Array.from(this.cache.keys());
  }
  values(): T[] {
    return Array.from(this.cache.values())
      .filter((i) => i.expires >= Date.now())
      .map((i) => i.value);
  }
  entries(): [string, T][] {
    return Array.from(this.cache.entries())
      .filter(([, i]) => i.expires >= Date.now())
      .map(([k, i]) => [k, i.value]);
  }
}

// 全局缓存实例
export const globalCache = new CacheManager();
export const sessionCache = new CacheManager(200, 60000); // 1分钟TTL
export const persistentCache = new CacheManager(1000, 86400000); // 24小时TTL

// 装饰器：缓存方法结果
export function cached(ttl?: number) {
  return function <T extends (...args: any[]) => any>(
    _target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const original = descriptor.value!;
    descriptor.value = function (this: any, ...args: Parameters<T>): ReturnType<T> {
      const key = `${propertyKey}:${JSON.stringify(args)}`;
      return globalCache.getOrSet(key, () => original.apply(this, args), ttl) as ReturnType<T>;
    } as T;
    return descriptor;
  };
}

export { CacheManager };
export default globalCache;
