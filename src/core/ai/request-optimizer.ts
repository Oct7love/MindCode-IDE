// AI 请求优化器 - 连接预热、请求去重、响应缓存
import { requestPipeline } from "../performance";
import { DEFAULT_BASE_URLS } from "./config";

// ==================== 连接预热 ====================
const warmupEndpoints: Record<string, string> = {
  claude: DEFAULT_BASE_URLS.claude,
  openai: DEFAULT_BASE_URLS.openai,
  deepseek: DEFAULT_BASE_URLS.deepseek,
  glm: DEFAULT_BASE_URLS.glm,
  codesuc: DEFAULT_BASE_URLS.codesuc,
};

let warmedUp = false;

export async function warmupConnections(): Promise<void> {
  // 预热 TCP 连接 (DNS + TLS)
  if (warmedUp) return;
  warmedUp = true;
  const start = Date.now();
  await Promise.allSettled(
    Object.entries(warmupEndpoints).map(async ([_name, url]) => {
      try {
        await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(2000) });
      } catch {
        /* 忽略错误，只需建立连接 */
      }
    }),
  );
  console.log(`[AI] 连接预热完成: ${Date.now() - start}ms`);
}

// ==================== 请求去重 ====================
export async function dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return requestPipeline.dedupe(key, fn);
}

// ==================== 流式响应优化 ====================
export class StreamBuffer {
  private buffer: string[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private onFlush: (text: string) => void;
  private batchMs: number;

  constructor(onFlush: (text: string) => void, batchMs = 16) {
    // 默认 ~60fps
    this.onFlush = onFlush;
    this.batchMs = batchMs;
  }

  push(token: string): void {
    this.buffer.push(token);
    if (!this.flushInterval) {
      this.flushInterval = setTimeout(() => this.flush(), this.batchMs);
    }
  }

  flush(): void {
    if (this.buffer.length > 0) {
      this.onFlush(this.buffer.join(""));
      this.buffer = [];
    }
    if (this.flushInterval) {
      clearTimeout(this.flushInterval);
      this.flushInterval = null;
    }
  }

  destroy(): void {
    this.flush();
  }
}

// ==================== 首次响应优化 ====================
export class FirstTokenOptimizer {
  private pendingRequests: Map<
    string,
    { resolve: (v: string) => void; reject: (e: Error) => void }[]
  > = new Map();

  // 对于相同的 prompt，只发送一次请求
  async optimizedRequest(key: string, fn: () => Promise<string>): Promise<string> {
    const pending = this.pendingRequests.get(key);
    if (pending) {
      return new Promise((resolve, reject) => {
        pending.push({ resolve, reject });
      });
    }
    this.pendingRequests.set(key, []);
    try {
      const result = await fn();
      const waiters = this.pendingRequests.get(key) || [];
      waiters.forEach((w) => w.resolve(result));
      return result;
    } catch (err) {
      const waiters = this.pendingRequests.get(key) || [];
      waiters.forEach((w) => w.reject(err as Error));
      throw err;
    } finally {
      this.pendingRequests.delete(key);
    }
  }
}

// ==================== 响应缓存 (短期) ====================
export class ResponseCache {
  private cache: Map<string, { response: string; timestamp: number }> = new Map();
  private ttlMs: number;
  private maxSize: number;

  constructor(ttlMs = 60000, maxSize = 100) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
  }

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.response;
  }

  set(key: string, response: string): void {
    if (this.cache.size >= this.maxSize) {
      const oldest = [...this.cache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) this.cache.delete(oldest[0]);
    }
    this.cache.set(key, { response, timestamp: Date.now() });
  }

  generateKey(model: string, messages: { role: string; content: string }[]): string {
    const content = messages.map((m) => `${m.role}:${m.content.slice(0, 100)}`).join("|");
    return `${model}:${content}`.slice(0, 500);
  }
}

// ==================== 全局实例 ====================
export const firstTokenOptimizer = new FirstTokenOptimizer();
export const responseCache = new ResponseCache();

// 初始化时预热连接
if (typeof window === "undefined") {
  // 仅在 Node.js (主进程) 中运行
  setTimeout(warmupConnections, 500);
}
