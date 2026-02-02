/**
 * MindCode Completion Service v3.0
 * 高性能代码补全服务 - 使用 IPC 调用（无需本地服务器）
 */

export interface CompletionRequest {
  file_path: string;
  content: string;
  cursor_line: number;
  cursor_column: number;
  mode: 'inline' | 'block';
  recent_files?: string[];
}

export interface CompletionResponse {
  completion: string;
  finish_reason: string;
  model: string;
  latency_ms: number;
  cached: boolean;
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime_seconds: number;
}

// 使用模式：IPC (Electron) 或 HTTP (本地服务器)
type ServiceMode = 'ipc' | 'http';

// 高性能 LRU 缓存
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(key, value);
  }

  clear(): void {
    this.cache.clear();
  }
}

// 智能触发字符 - 这些字符后立即触发补全（0ms 延迟）
const INSTANT_TRIGGER_CHARS = new Set(['.', '(', '[', '{', ':', '/', '>', '"', "'", '=', ',', ' ']);
// 注释开始 - 触发 block 模式
const COMMENT_PATTERNS = ['//', '/*', '#', '"""', "'''"];

class CompletionService {
  private baseUrl: string;
  private cache: LRUCache<string, CompletionResponse>;
  private fuzzyCache: LRUCache<string, CompletionResponse>; // 模糊缓存（相似上下文）
  private pendingRequest: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private defaultDebounceMs: number;
  private instantDebounceMs: number;
  private mode: ServiceMode = 'ipc';

  constructor(baseUrl = 'http://localhost:8765', defaultDebounceMs = 30, instantDebounceMs = 5, cacheSize = 500) { // 极速防抖：30ms/5ms
    this.baseUrl = baseUrl;
    this.defaultDebounceMs = defaultDebounceMs;
    this.instantDebounceMs = instantDebounceMs;
    this.cache = new LRUCache<string, CompletionResponse>(cacheSize);
    this.fuzzyCache = new LRUCache<string, CompletionResponse>(cacheSize); // 模糊缓存
    if (typeof window !== 'undefined' && window.mindcode?.ai?.completion) { this.mode = 'ipc'; console.log('[CompletionService] 使用 IPC 模式'); }
    else { this.mode = 'http'; console.log('[CompletionService] 使用 HTTP 模式'); }
  }
  
  /**
   * 通过 IPC 请求补全
   */
  private async requestViaIPC(request: CompletionRequest): Promise<CompletionResponse | null> {
    const startTime = Date.now();
    
    try {
      // 使用 Codesuc 特价渠道 (Claude)
      const result = await window.mindcode.ai.completion({
        filePath: request.file_path,
        code: request.content,
        cursorLine: request.cursor_line,
        cursorColumn: request.cursor_column,
        model: 'codesuc-sonnet',  // 特价渠道 Claude Sonnet
      });

      if (result.success && result.data) {
        return {
          completion: result.data,
          finish_reason: 'complete',
          model: 'codesuc-sonnet',
          latency_ms: Date.now() - startTime,
          cached: result.cached || false,
        };
      }
      
      console.log('[CompletionService] IPC 请求失败:', result.error);
      return null;
    } catch (error) {
      console.error('[CompletionService] IPC 请求异常:', error);
      return null;
    }
  }

  private getCacheKey(request: CompletionRequest): string {
    const contentHash = request.content.slice(-500);
    return `${request.file_path}:${request.cursor_line}:${request.cursor_column}:${request.mode}:${contentHash}`;
  }

  private getFuzzyCacheKey(request: CompletionRequest): string { // 模糊缓存 key（忽略列位置）
    const lines = request.content.split('\n');
    const currentLine = lines[request.cursor_line] || '';
    const prefix = currentLine.slice(0, Math.min(request.cursor_column, 30)); // 只取当前行前 30 字符
    return `${request.file_path}:${request.cursor_line}:${prefix}:${request.mode}`;
  }

  private tryFuzzyCache(request: CompletionRequest): CompletionResponse | null {
    const fuzzyKey = this.getFuzzyCacheKey(request);
    const cached = this.fuzzyCache.get(fuzzyKey);
    if (cached && cached.completion) {
      const lines = request.content.split('\n');
      const currentLine = lines[request.cursor_line] || '';
      const typed = currentLine.slice(0, request.cursor_column);
      // 检查缓存的补全是否仍然适用
      if (cached.completion.startsWith(typed.slice(-10)) || typed.endsWith(cached.completion.slice(0, 5))) {
        return { ...cached, cached: true };
      }
    }
    return null;
  }

  // 判断是否应该立即触发
  private shouldInstantTrigger(content: string, cursorColumn: number): boolean {
    if (cursorColumn <= 0) return false;
    const lines = content.split('\n');
    const currentLine = lines[lines.length - 1] || '';
    if (cursorColumn > currentLine.length) return false;

    const charBeforeCursor = currentLine[cursorColumn - 1];
    return INSTANT_TRIGGER_CHARS.has(charBeforeCursor);
  }

  // 判断是否在注释中（可能需要 block 模式）
  private isInComment(content: string): boolean {
    const lastLine = content.split('\n').pop() || '';
    return COMMENT_PATTERNS.some(p => lastLine.trimStart().startsWith(p));
  }

  async healthCheck(): Promise<HealthResponse | null> {
    // IPC 模式下直接返回健康状态
    if (this.mode === 'ipc') {
      return {
        status: 'ok',
        version: 'ipc-3.0',
        uptime_seconds: 0,
      };
    }
    
    // HTTP 模式
    try {
      const response = await fetch(`${this.baseUrl}/v1/health`, {
        signal: AbortSignal.timeout(3000)  // 3秒超时
      });
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  /** 请求代码补全（智能防抖 + 模糊缓存） */
  async getCompletion(request: CompletionRequest): Promise<CompletionResponse | null> {
    // 1. 精确缓存
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) return { ...cached, cached: true };
    // 2. 模糊缓存（相似上下文）
    const fuzzyCached = this.tryFuzzyCache(request);
    if (fuzzyCached) return fuzzyCached;

    // 取消之前的请求
    if (this.pendingRequest) {
      this.pendingRequest.abort();
      this.pendingRequest = null;
    }

    // 清除之前的防抖定时器
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // 智能防抖：根据触发条件选择延迟
    const debounceMs = this.shouldInstantTrigger(request.content, request.cursor_column)
      ? this.instantDebounceMs
      : this.defaultDebounceMs;

    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        try {
          let data: CompletionResponse | null = null;
          
          // 根据模式选择请求方式
          if (this.mode === 'ipc') {
            data = await this.requestViaIPC(request);
          } else {
            // HTTP 模式
            const controller = new AbortController();
            this.pendingRequest = controller;

            const response = await fetch(`${this.baseUrl}/v1/completion`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(request),
              signal: controller.signal,
            });

            if (!response.ok) {
              resolve(null);
              return;
            }

            data = await response.json();
          }

          // 存入缓存（精确 + 模糊）
          if (data && data.completion && data.completion.length > 0) {
            this.cache.set(cacheKey, data);
            this.fuzzyCache.set(this.getFuzzyCacheKey(request), data); // 模糊缓存
          }
          resolve(data);
        } catch (error) {
          if ((error as Error).name === 'AbortError') {
            resolve(null);
          } else {
            console.error('[CompletionService] 请求失败:', error);
            resolve(null);
          }
        } finally {
          this.pendingRequest = null;
        }
      }, debounceMs);
    });
  }

  /**
   * 立即请求补全（无防抖，用于快捷键触发）
   */
  async getCompletionImmediate(request: CompletionRequest): Promise<CompletionResponse | null> {
    // 取消任何待处理的请求
    this.cancel();

    // 检查缓存
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, cached: true };
    }

    try {
      // 根据模式选择请求方式
      if (this.mode === 'ipc') {
        const data = await this.requestViaIPC(request);
        if (data && data.completion && data.completion.length > 0) {
          this.cache.set(cacheKey, data);
        }
        return data;
      }
      
      // HTTP 模式
      const controller = new AbortController();
      this.pendingRequest = controller;

      const response = await fetch(`${this.baseUrl}/v1/completion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data: CompletionResponse = await response.json();

      if (data.completion && data.completion.length > 0) {
        this.cache.set(cacheKey, data);
      }

      return data;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('[CompletionService] 立即请求失败:', error);
      }
      return null;
    } finally {
      this.pendingRequest = null;
    }
  }

  /**
   * 预取补全（在用户可能需要时提前请求）
   */
  prefetch(request: CompletionRequest): void {
    const cacheKey = this.getCacheKey(request);
    if (this.cache.get(cacheKey)) return;  // 已缓存

    // 静默预取，不影响当前请求
    fetch(`${this.baseUrl}/v1/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
      .then(res => res.json())
      .then((data: CompletionResponse) => {
        if (data.completion && data.completion.length > 0) {
          this.cache.set(cacheKey, data);
        }
      })
      .catch(() => {});  // 静默失败
  }

  cancel(): void {
    if (this.pendingRequest) {
      this.pendingRequest.abort();
      this.pendingRequest = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }

  setBaseUrl(url: string): void {
    this.baseUrl = url;
    this.clearCache();
  }

  // 检查是否应该使用 block 模式
  shouldUseBlockMode(content: string, cursorLine: number): boolean {
    const lines = content.split('\n');
    if (cursorLine >= lines.length) return false;

    const currentLine = lines[cursorLine] || '';
    const trimmed = currentLine.trimStart();

    // 注释行可能需要 block 模式
    if (COMMENT_PATTERNS.some(p => trimmed.startsWith(p))) {
      return true;
    }

    return false;
  }
}

// 导出单例
export const completionService = new CompletionService();
export default completionService;
