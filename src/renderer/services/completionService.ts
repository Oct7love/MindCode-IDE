/**
 * MindCode Completion Service v4.0 - 超越 Cursor
 * 极速补全：智能缓存+预取+多模型融合 目标<100ms
 */

import { completionCache } from "./completionCache";

export interface CompletionRequest {
  file_path: string;
  content: string;
  cursor_line: number;
  cursor_column: number;
  mode: "inline" | "block";
  recent_files?: string[];
}

export interface CompletionResponse {
  completion: string;
  finish_reason: string;
  model: string;
  latency_ms: number;
  cached: boolean;
  cacheScore?: number; // 缓存命中评分 (1.0=精确, 0.8=模糊, 0.5=前缀)
}

export interface HealthResponse {
  status: string;
  version: string;
  uptime_seconds: number;
}

type ServiceMode = "ipc" | "http";

// 智能触发字符 - 立即触发 (0ms 延迟)
const INSTANT_TRIGGER_CHARS = new Set([".", "(", "[", "{", ":", "/", ">", '"', "'", "=", ",", " "]);
const COMMENT_PATTERNS = ["//", "/*", "#", '"""', "'''"];

class CompletionService {
  private baseUrl: string;
  private pendingRequest: AbortController | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private defaultDebounceMs: number;
  private instantDebounceMs: number;
  private mode: ServiceMode = "ipc";
  private prefetchQueue: Set<string> = new Set(); // 预取队列

  constructor(
    baseUrl = "http://localhost:8765",
    defaultDebounceMs = 20,
    instantDebounceMs = 0,
    _cacheSize = 500,
  ) {
    // 极速：20ms/0ms
    this.baseUrl = baseUrl;
    this.defaultDebounceMs = defaultDebounceMs;
    this.instantDebounceMs = instantDebounceMs;
    if (typeof window !== "undefined" && typeof window.mindcode?.ai?.completion === "function") {
      this.mode = "ipc";
      console.log("[CompletionService] IPC模式 v4.0");
    } else {
      this.mode = "http";
      console.log("[CompletionService] HTTP模式");
    }
  }

  /** IPC 请求补全 */
  private async requestViaIPC(request: CompletionRequest): Promise<CompletionResponse | null> {
    const startTime = Date.now();
    try {
      const result = await window.mindcode.ai.completion({
        filePath: request.file_path,
        code: request.content,
        cursorLine: request.cursor_line,
        cursorColumn: request.cursor_column,
        model: "codesuc-sonnet",
      });
      if (result.success && result.data) {
        return {
          completion: result.data,
          finish_reason: "complete",
          model: "codesuc-sonnet",
          latency_ms: Date.now() - startTime,
          cached: result.cached || false,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /** 获取当前行内容 */
  private getLineContent(content: string, line: number): string {
    return content.split("\n")[line] || "";
  }

  /** 获取光标前缀 */
  private getPrefix(content: string, line: number, col: number): string {
    const lineContent = this.getLineContent(content, line);
    return lineContent.slice(0, col);
  }

  /** 是否立即触发 */
  private shouldInstantTrigger(content: string, line: number, col: number): boolean {
    const prefix = this.getPrefix(content, line, col);
    const trigger = prefix.slice(-1);
    return INSTANT_TRIGGER_CHARS.has(trigger);
  }

  async healthCheck(): Promise<HealthResponse | null> {
    if (this.mode === "ipc") return { status: "ok", version: "ipc-4.0", uptime_seconds: 0 };
    try {
      const response = await fetch(`${this.baseUrl}/v1/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }

  /** 请求补全 - 极速版 v4.0 */
  async getCompletion(request: CompletionRequest): Promise<CompletionResponse | null> {
    const startTime = Date.now();
    const { file_path, content, cursor_line, cursor_column } = request;
    const lineContent = this.getLineContent(content, cursor_line);
    const prefix = this.getPrefix(content, cursor_line, cursor_column);

    // 1. 智能缓存查询
    const cached = completionCache.get(file_path, cursor_line, cursor_column, prefix, lineContent);
    if (cached) {
      console.log(
        `[Completion] 缓存命中 score=${cached.score} latency=${Date.now() - startTime}ms`,
      );
      return {
        completion: cached.completion,
        finish_reason: "cached",
        model: cached.model,
        latency_ms: Date.now() - startTime,
        cached: true,
        cacheScore: cached.score,
      };
    }

    // 2. 取消旧请求
    this.cancel();

    // 3. 智能防抖
    const debounceMs = this.shouldInstantTrigger(content, cursor_line, cursor_column)
      ? this.instantDebounceMs
      : this.defaultDebounceMs;

    return new Promise((resolve) => {
      this.debounceTimer = setTimeout(async () => {
        try {
          const data =
            this.mode === "ipc"
              ? await this.requestViaIPC(request)
              : await this.requestViaHTTP(request);
          if (data?.completion) {
            completionCache.set(
              file_path,
              cursor_line,
              cursor_column,
              prefix,
              lineContent,
              data.completion,
              data.model,
            );
            console.log(`[Completion] 请求完成 latency=${data.latency_ms}ms model=${data.model}`);
          }
          resolve(data);
        } catch (e) {
          if ((e as Error).name !== "AbortError") console.error("[Completion] 错误:", e);
          resolve(null);
        } finally {
          this.pendingRequest = null;
        }
      }, debounceMs);
    });
  }

  /** HTTP 请求 */
  private async requestViaHTTP(request: CompletionRequest): Promise<CompletionResponse | null> {
    const controller = new AbortController();
    this.pendingRequest = controller;
    try {
      const response = await fetch(`${this.baseUrl}/v1/completion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }

  /** 立即请求 (快捷键触发) */
  async getCompletionImmediate(request: CompletionRequest): Promise<CompletionResponse | null> {
    this.cancel();
    const { file_path, content, cursor_line, cursor_column } = request;
    const lineContent = this.getLineContent(content, cursor_line);
    const prefix = this.getPrefix(content, cursor_line, cursor_column);
    const cached = completionCache.get(file_path, cursor_line, cursor_column, prefix, lineContent);
    if (cached)
      return {
        completion: cached.completion,
        finish_reason: "cached",
        model: cached.model,
        latency_ms: 0,
        cached: true,
        cacheScore: cached.score,
      };
    const data =
      this.mode === "ipc" ? await this.requestViaIPC(request) : await this.requestViaHTTP(request);
    if (data?.completion)
      completionCache.set(
        file_path,
        cursor_line,
        cursor_column,
        prefix,
        lineContent,
        data.completion,
        data.model,
      );
    return data;
  }

  /** 预取补全 (后台静默) */
  prefetch(request: CompletionRequest): void {
    const key = `${request.file_path}:${request.cursor_line}`;
    if (this.prefetchQueue.has(key)) return;
    this.prefetchQueue.add(key);
    setTimeout(() => this.prefetchQueue.delete(key), 5000); // 5秒内不重复预取
    (async () => {
      const data =
        this.mode === "ipc"
          ? await this.requestViaIPC(request)
          : await this.requestViaHTTP(request);
      if (data?.completion) {
        const lineContent = this.getLineContent(request.content, request.cursor_line);
        const prefix = this.getPrefix(request.content, request.cursor_line, request.cursor_column);
        completionCache.set(
          request.file_path,
          request.cursor_line,
          request.cursor_column,
          prefix,
          lineContent,
          data.completion,
          data.model,
        );
      }
    })().catch(() => {});
  }

  /** 智能预取 - 预测下一行 */
  prefetchNextLines(filePath: string, content: string, currentLine: number): void {
    for (let i = 1; i <= 3; i++) {
      // 预取接下来 3 行
      const line = currentLine + i;
      const lineContent = this.getLineContent(content, line);
      if (!lineContent.trim()) continue; // 跳过空行
      this.prefetch({
        file_path: filePath,
        content,
        cursor_line: line,
        cursor_column: lineContent.length,
        mode: "inline",
      });
    }
  }

  /** 高优先级预取 - 基于代码结构和光标移动方向 */
  prefetchSmart(
    filePath: string,
    content: string,
    currentLine: number,
    direction: "up" | "down" = "down",
  ): void {
    const lines = content.split("\n");
    const targets: number[] = [];
    // 基于移动方向预取
    const step = direction === "down" ? 1 : -1;
    for (let i = 1; i <= 3; i++) {
      const line = currentLine + i * step;
      if (line >= 0 && line < lines.length) targets.push(line);
    }
    // 检测代码结构热点(函数定义后、循环/条件语句内)
    const currentLineText = lines[currentLine] || "";
    if (/^\s*(function|const\s+\w+\s*=|class|if|for|while|switch)\b/.test(currentLineText)) {
      for (let i = 1; i <= 5; i++) {
        if (currentLine + i < lines.length) targets.push(currentLine + i);
      }
    }
    // 去重并预取
    [...new Set(targets)].slice(0, 5).forEach((line) => {
      const lineContent = lines[line] || "";
      if (lineContent.trim())
        this.prefetch({
          file_path: filePath,
          content,
          cursor_line: line,
          cursor_column: lineContent.length,
          mode: "inline",
        });
    });
  }

  cancel(): void {
    this.pendingRequest?.abort();
    this.pendingRequest = null;
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  clearCache(): void {
    completionCache.clear();
  }
  setBaseUrl(url: string): void {
    this.baseUrl = url;
    this.clearCache();
  }
  getCacheStats() {
    return completionCache.stats();
  }

  shouldUseBlockMode(content: string, cursorLine: number): boolean {
    const line = this.getLineContent(content, cursorLine).trimStart();
    return COMMENT_PATTERNS.some((p) => line.startsWith(p));
  }
}

// 导出单例
export const completionService = new CompletionService();
export default completionService;
