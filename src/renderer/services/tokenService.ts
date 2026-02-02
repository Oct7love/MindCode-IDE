/**
 * Token 计算服务
 * 使用 Web Worker 异步计算，避免 UI 阻塞
 */

import TokenWorker from '../workers/tokenWorker?worker';

type TokenCallback = (count: number, error?: string) => void;
interface PendingRequest { resolve: TokenCallback; reject: (err: Error) => void; }

class TokenService {
  private worker: Worker | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 0;
  private cache = new Map<string, number>(); // LRU 缓存
  private cacheMaxSize = 500;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new TokenWorker();
      this.worker.onmessage = (e) => {
        const { id, count, error } = e.data;
        const request = this.pending.get(id);
        if (request) {
          this.pending.delete(id);
          if (error) request.reject(new Error(error));
          else request.resolve(count, undefined);
        }
      };
    }
    return this.worker;
  }

  /** 异步计算 token 数量 */
  countTokens(text: string, model?: string): Promise<number> {
    const cacheKey = `${model || 'default'}:${text.slice(0, 100)}`; // 简单缓存 key
    const cached = this.cache.get(cacheKey);
    if (cached !== undefined) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve: (count) => { this.addToCache(cacheKey, count); resolve(count); }, reject });
      this.getWorker().postMessage({ id, text, model });
    });
  }

  /** 同步估算（快速，不阻塞） */
  estimateSync(text: string): number {
    const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    return Math.ceil(chineseChars / 1.5 + (text.length - chineseChars) / 4);
  }

  private addToCache(key: string, value: number): void {
    if (this.cache.size >= this.cacheMaxSize) { this.cache.delete(this.cache.keys().next().value!); }
    this.cache.set(key, value);
  }

  /** 清理 */
  dispose(): void { this.worker?.terminate(); this.worker = null; this.pending.clear(); }
}

export const tokenService = new TokenService();
export default tokenService;
