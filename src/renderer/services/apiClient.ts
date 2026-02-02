/**
 * API Client - HTTP 请求封装
 */

import { errorHandler, NetworkError } from './errorHandler';
import { performanceMonitor } from './performanceMonitor';

interface RequestConfig { method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'; headers?: Record<string, string>; body?: unknown; timeout?: number; retry?: number; retryDelay?: number; cache?: boolean; }
interface ApiResponse<T> { data: T; status: number; headers: Headers; }

class ApiClient {
  private baseURL = '';
  private defaultHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  private interceptors: { request: ((config: RequestConfig) => RequestConfig)[]; response: ((res: Response) => Response)[]; } = { request: [], response: [] };
  private cache = new Map<string, { data: unknown; expires: number }>();
  private pending = new Map<string, Promise<unknown>>();

  setBaseURL(url: string): void { this.baseURL = url; }
  setHeader(key: string, value: string): void { this.defaultHeaders[key] = value; }
  removeHeader(key: string): void { delete this.defaultHeaders[key]; }

  addRequestInterceptor(fn: (config: RequestConfig) => RequestConfig): void { this.interceptors.request.push(fn); }
  addResponseInterceptor(fn: (res: Response) => Response): void { this.interceptors.response.push(fn); }

  async request<T>(url: string, config: RequestConfig = {}): Promise<ApiResponse<T>> {
    const fullUrl = url.startsWith('http') ? url : `${this.baseURL}${url}`;
    let cfg = { method: 'GET', timeout: 30000, retry: 0, retryDelay: 1000, ...config };
    for (const fn of this.interceptors.request) cfg = fn(cfg);

    const cacheKey = `${cfg.method}:${fullUrl}:${JSON.stringify(cfg.body)}`;
    if (cfg.cache && cfg.method === 'GET') { // 缓存检查
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expires > Date.now()) return { data: cached.data as T, status: 200, headers: new Headers() };
      if (this.pending.has(cacheKey)) return this.pending.get(cacheKey) as Promise<ApiResponse<T>>; // 请求去重
    }

    const fetchWithRetry = async (attempt: number): Promise<ApiResponse<T>> => {
      performanceMonitor.mark(`api:${cacheKey}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), cfg.timeout);

      try {
        let response = await fetch(fullUrl, {
          method: cfg.method,
          headers: { ...this.defaultHeaders, ...cfg.headers },
          body: cfg.body ? JSON.stringify(cfg.body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        for (const fn of this.interceptors.response) response = fn(response);
        if (!response.ok) throw new NetworkError(`HTTP ${response.status}`, { url: fullUrl, status: response.status });
        const data = await response.json();
        performanceMonitor.measure(`api:${cacheKey}`, undefined, { url: fullUrl, method: cfg.method });
        if (cfg.cache && cfg.method === 'GET') this.cache.set(cacheKey, { data, expires: Date.now() + 60000 });
        return { data, status: response.status, headers: response.headers };
      } catch (e) {
        clearTimeout(timeoutId);
        if (attempt < cfg.retry!) { await new Promise(r => setTimeout(r, cfg.retryDelay! * (attempt + 1))); return fetchWithRetry(attempt + 1); }
        errorHandler.capture(e as Error, { url: fullUrl, attempt });
        throw e;
      }
    };

    const promise = fetchWithRetry(0);
    if (cfg.cache) { this.pending.set(cacheKey, promise); promise.finally(() => this.pending.delete(cacheKey)); }
    return promise;
  }

  get<T>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> { return this.request<T>(url, { ...config, method: 'GET' }); }
  post<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> { return this.request<T>(url, { ...config, method: 'POST', body }); }
  put<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> { return this.request<T>(url, { ...config, method: 'PUT', body }); }
  patch<T>(url: string, body?: unknown, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> { return this.request<T>(url, { ...config, method: 'PATCH', body }); }
  delete<T>(url: string, config?: Omit<RequestConfig, 'method' | 'body'>): Promise<ApiResponse<T>> { return this.request<T>(url, { ...config, method: 'DELETE' }); }

  clearCache(): void { this.cache.clear(); }
}

export const apiClient = new ApiClient();
export default apiClient;
