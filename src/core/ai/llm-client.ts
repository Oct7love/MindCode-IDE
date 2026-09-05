// LLM 客户端中间件 - 限流/重试/熔断/降级
import { EventEmitter } from "events";
import type { ChatMessage, ToolSchema, ToolCallInfo, AIProvider } from "@shared/types/ai";
import { logger } from "../logger";

const log = logger.child("LLM");

// === 配置 ===
export const LLM_CONFIG = {
  MAX_CONCURRENCY_PER_MODEL: 3, // 每模型最大并发
  MAX_QUEUE_LENGTH: 15, // 最大排队长度
  RETRY_MAX: 2, // 最大重试次数 (减少以加快失败反馈)
  RETRY_BASE_MS: 500, // 重试基础延迟 (减少等待)
  RETRY_MAX_MS: 10000, // 最大重试延迟
  TIMEOUT_CONNECT_MS: 15000, // 连接超时
  TIMEOUT_READ_MS: 60000, // 读取超时 (60s，流式由 Provider 侧空闲超时兜底)
  CIRCUIT_BREAKER_THRESHOLD: 3, // 熔断阈值 (降低以更快切换)
  CIRCUIT_BREAKER_RESET_MS: 30000, // 熔断恢复时间 (30秒后重试)
  FALLBACK_MODELS: {
    // 降级链
    "claude-opus-4-6-thinking": [
      "claude-sonnet-4-5-thinking",
      "claude-sonnet-4-5",
      "deepseek-chat",
      "glm-4.7-flashx",
    ],
    "claude-sonnet-4-5-thinking": ["claude-sonnet-4-5", "deepseek-chat", "glm-4.7-flashx"],
    "gemini-3-pro-high": ["gemini-3-flash", "gemini-2.5-flash", "deepseek-chat"],
    "deepseek-reasoner": ["deepseek-chat", "glm-4.7-flashx"],
    "glm-4.7": ["glm-4.7-flashx", "deepseek-chat"],
    // 特价渠道降级链（内部降级，不跨渠道）
    "codesuc-opus": ["codesuc-sonnet", "codesuc-haiku"],
    "codesuc-sonnet": ["codesuc-haiku"],
    "special-claude-opus-4-6": ["codesuc-sonnet", "codesuc-haiku"], // 兼容旧 ID
    "special-claude-sonnet-4-5": ["codesuc-haiku"],
  } as Record<string, string[]>,
};

// === 错误分类 ===
export type LLMErrorType =
  | "rate_limit"
  | "capacity"
  | "timeout"
  | "network"
  | "auth"
  | "cancelled"
  | "unknown";
export interface LLMError {
  type: LLMErrorType;
  message: string;
  retryable: boolean;
  statusCode?: number;
  suggestFallback?: boolean;
}

export function classifyError(error: unknown): LLMError {
  const err = error as Record<string, unknown> | undefined;
  const name = String(err?.name || "");
  const msg = String(err?.message || error || "").toLowerCase();
  const code = err?.status || err?.statusCode || (msg.match(/(\d{3})/) || [])[1];
  if (
    name === "AbortError" ||
    msg.includes("aborted") ||
    msg.includes("aborterror") ||
    (typeof err?.code === "string" && err.code === "ABORT_ERR")
  ) {
    return { type: "cancelled", message: "请求已取消", retryable: false };
  }
  if (code === 429 || msg.includes("rate") || msg.includes("limit") || msg.includes("too many"))
    return {
      type: "rate_limit",
      message: "请求过于频繁，系统将自动重试",
      retryable: true,
      statusCode: 429,
    };
  if (
    code === 503 ||
    msg.includes("capacity") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded")
  )
    return {
      type: "capacity",
      message: "模型容量不足，建议切换稳定模型",
      retryable: true,
      statusCode: 503,
      suggestFallback: true,
    };
  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("etimedout"))
    return { type: "timeout", message: "请求超时，可能上游排队较长", retryable: true };
  if (msg.includes("econnrefused") || msg.includes("enotfound") || msg.includes("network"))
    return { type: "network", message: "网络连接失败", retryable: true };
  if (code === 401 || code === 403 || msg.includes("auth") || msg.includes("key"))
    return { type: "auth", message: "API 密钥无效", retryable: false };
  return { type: "unknown", message: (err?.message as string) || "未知错误", retryable: false };
}

// === 熔断器 ===
class CircuitBreaker {
  private failures = new Map<string, { count: number; openUntil: number }>();
  isOpen(model: string): boolean {
    const state = this.failures.get(model);
    if (!state) return false;
    if (Date.now() > state.openUntil) {
      this.failures.delete(model);
      return false;
    } // 熔断恢复
    return state.count >= LLM_CONFIG.CIRCUIT_BREAKER_THRESHOLD;
  }
  recordFailure(model: string): void {
    const state = this.failures.get(model) || { count: 0, openUntil: 0 };
    state.count++;
    if (state.count >= LLM_CONFIG.CIRCUIT_BREAKER_THRESHOLD)
      state.openUntil = Date.now() + LLM_CONFIG.CIRCUIT_BREAKER_RESET_MS;
    this.failures.set(model, state);
  }
  recordSuccess(model: string): void {
    this.failures.delete(model);
  }
  getState(model: string): { open: boolean; failCount: number } {
    const state = this.failures.get(model);
    return { open: this.isOpen(model), failCount: state?.count || 0 };
  }
}

// === 请求队列 ===
interface QueuedRequest<T> {
  execute: () => Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
  model: string;
}
class RequestQueue {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 异构队列需要类型擦除
  private queues = new Map<string, QueuedRequest<any>[]>();
  private running = new Map<string, number>();
  async enqueue<T>(model: string, execute: () => Promise<T>): Promise<T> {
    const currentRunning = this.running.get(model) || 0;
    if (currentRunning < LLM_CONFIG.MAX_CONCURRENCY_PER_MODEL) return this.run(model, execute);
    const queue = this.queues.get(model) || [];
    if (queue.length >= LLM_CONFIG.MAX_QUEUE_LENGTH) throw new Error("请求队列已满，请稍后重试");
    return new Promise((resolve, reject) => {
      queue.push({ execute, resolve, reject, model });
      this.queues.set(model, queue);
    });
  }
  private async run<T>(model: string, execute: () => Promise<T>): Promise<T> {
    this.running.set(model, (this.running.get(model) || 0) + 1);
    try {
      return await execute();
    } finally {
      this.running.set(model, (this.running.get(model) || 1) - 1);
      this.processQueue(model);
    }
  }
  private processQueue(model: string): void {
    const queue = this.queues.get(model);
    if (!queue || queue.length === 0) return;
    const currentRunning = this.running.get(model) || 0;
    if (currentRunning >= LLM_CONFIG.MAX_CONCURRENCY_PER_MODEL) return;
    const next = queue.shift()!;
    this.run(model, next.execute).then(next.resolve).catch(next.reject);
  }
  getStats(): Record<string, { running: number; queued: number }> {
    const stats: Record<string, { running: number; queued: number }> = {};
    for (const [model, count] of this.running)
      stats[model] = { running: count, queued: this.queues.get(model)?.length || 0 };
    return stats;
  }
}

// === 重试逻辑 ===
async function withRetry<T>(
  fn: () => Promise<T>,
  model: string,
  breaker: CircuitBreaker,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= LLM_CONFIG.RETRY_MAX; attempt++) {
    try {
      const result = await fn();
      breaker.recordSuccess(model);
      return result;
    } catch (error) {
      lastError = error;
      const classified = classifyError(error);
      if (!classified.retryable || attempt === LLM_CONFIG.RETRY_MAX) {
        breaker.recordFailure(model);
        throw error;
      }
      const delay = Math.min(
        LLM_CONFIG.RETRY_BASE_MS * Math.pow(2, attempt) + Math.random() * 500,
        LLM_CONFIG.RETRY_MAX_MS,
      ); // 指数退避 + jitter
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// === 降级逻辑 ===
export function getFallbackModel(model: string, triedModels: Set<string>): string | null {
  const fallbacks = LLM_CONFIG.FALLBACK_MODELS[model] || [];
  for (const fb of fallbacks) if (!triedModels.has(fb)) return fb;
  return null;
}

// === LLM 客户端 ===
export interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  tools?: ToolSchema[];
  userId?: string;
  requestId?: string;
  signal?: AbortSignal;
}
export interface LLMResponse {
  success: boolean;
  data?: string;
  model: string;
  usedFallback?: boolean;
  error?: LLMError;
  retryCount?: number;
}
export interface LLMStreamCallbacks {
  onToken: (token: string) => void;
  onToolCall?: (calls: ToolCallInfo[]) => void;
  onComplete: (text: string, meta: { model: string; usedFallback: boolean }) => void;
  onError: (error: LLMError) => void;
  onFallback?: (from: string, to: string) => void;
}

export class LLMClient extends EventEmitter {
  private breaker = new CircuitBreaker();
  private queue = new RequestQueue();
  private providers: Map<string, AIProvider>;
  constructor(providers: Map<string, AIProvider>) {
    super();
    this.providers = providers;
  }

  private getProviderForModel(model: string): AIProvider | undefined {
    let providerName = "claude"; // 默认
    if (model.startsWith("codesuc-") || model.startsWith("special-claude-"))
      providerName = "codesuc"; // 特价渠道（兼容旧 ID）
    else if (model.startsWith("claude-")) providerName = "claude";
    else if (model.startsWith("gemini-") || model.includes("gemini-"))
      providerName = "gemini"; // 支持 [次]gemini- 格式
    else if (model.startsWith("deepseek-")) providerName = "deepseek";
    else if (model.startsWith("glm-")) providerName = "glm";
    else if (model.startsWith("gpt-")) providerName = "openai";
    log.info(`getProviderForModel: model=${model} -> provider=${providerName}`);
    return this.providers.get(providerName);
  }

  async chat(request: LLMRequest): Promise<LLMResponse> {
    const triedModels = new Set<string>();
    let currentModel = request.model;
    while (true) {
      triedModels.add(currentModel);
      if (this.breaker.isOpen(currentModel)) {
        // 熔断中，尝试降级
        const fallback = getFallbackModel(currentModel, triedModels);
        if (fallback) {
          this.emit("fallback", currentModel, fallback);
          currentModel = fallback;
          continue;
        }
        return {
          success: false,
          model: currentModel,
          error: { type: "capacity", message: "所有模型暂不可用，请稍后重试", retryable: false },
        };
      }
      try {
        const provider = this.getProviderForModel(currentModel);
        if (!provider) throw new Error(`未找到模型 ${currentModel} 对应的 Provider`);
        const data = await this.queue.enqueue<string>(currentModel, () =>
          withRetry(
            () => provider.setModel(currentModel).chat(request.messages),
            currentModel,
            this.breaker,
          ),
        );
        return {
          success: true,
          data,
          model: currentModel,
          usedFallback: currentModel !== request.model,
        };
      } catch (error) {
        const classified = classifyError(error);
        if (classified.suggestFallback) {
          const fallback = getFallbackModel(currentModel, triedModels);
          if (fallback) {
            this.emit("fallback", currentModel, fallback);
            currentModel = fallback;
            continue;
          }
        }
        return { success: false, model: currentModel, error: classified };
      }
    }
  }

  async chatStream(request: LLMRequest, callbacks: LLMStreamCallbacks): Promise<void> {
    const triedModels = new Set<string>();
    let currentModel = request.model;
    const tryStream = async (): Promise<void> => {
      if (request.signal?.aborted) {
        callbacks.onError({ type: "cancelled", message: "请求已取消", retryable: false });
        return;
      }
      triedModels.add(currentModel);
      if (this.breaker.isOpen(currentModel)) {
        const fallback = getFallbackModel(currentModel, triedModels);
        if (fallback) {
          callbacks.onFallback?.(currentModel, fallback);
          currentModel = fallback;
          return tryStream();
        }
        callbacks.onError({
          type: "capacity",
          message: "所有模型暂不可用，请稍后重试",
          retryable: false,
        });
        return;
      }
      const provider = this.getProviderForModel(currentModel);
      if (!provider) {
        callbacks.onError({
          type: "unknown",
          message: `未找到模型 ${currentModel} 对应的 Provider`,
          retryable: false,
        });
        return;
      }
      return this.queue.enqueue(
        currentModel,
        () =>
          new Promise<void>((resolve, reject) => {
            const wrappedCallbacks = {
              onToken: callbacks.onToken,
              onToolCall: callbacks.onToolCall || (() => {}),
              signal: request.signal,
              onComplete: (text: string) => {
                this.breaker.recordSuccess(currentModel);
                callbacks.onComplete(text, {
                  model: currentModel,
                  usedFallback: currentModel !== request.model,
                });
                resolve();
              },
              onError: async (error: Error) => {
                const classified = classifyError(error);
                if (classified.type === "cancelled") {
                  callbacks.onError(classified);
                  resolve();
                  return;
                }
                this.breaker.recordFailure(currentModel);
                if (classified.suggestFallback) {
                  const fallback = getFallbackModel(currentModel, triedModels);
                  if (fallback) {
                    callbacks.onFallback?.(currentModel, fallback);
                    currentModel = fallback;
                    tryStream().then(resolve).catch(reject);
                    return;
                  }
                }
                callbacks.onError(classified);
                reject(error);
              },
            };
            provider.setModel(currentModel);
            const p =
              request.tools && provider.chatWithTools
                ? provider.chatWithTools(request.messages, request.tools, wrappedCallbacks)
                : provider.chatStream(request.messages, wrappedCallbacks);
            p.catch((e: Error) => wrappedCallbacks.onError(e));
          }),
      );
    };
    await tryStream();
  }

  getStats(): {
    queue: Record<string, { running: number; queued: number }>;
    breakers: Record<string, { open: boolean; failCount: number }>;
  } {
    const breakers: Record<string, { open: boolean; failCount: number }> = {};
    for (const model of [
      "claude-opus-4-6-thinking",
      "claude-sonnet-4-5",
      "deepseek-chat",
      "gemini-3-flash",
    ])
      breakers[model] = this.breaker.getState(model);
    return { queue: this.queue.getStats(), breakers };
  }
}

// === 用户友好错误消息 ===
export function getUserFriendlyError(error: LLMError): string {
  switch (error.type) {
    case "rate_limit":
      return "⏳ 请求限流中，系统正在重试...（可切换 DeepSeek V3 获得更快响应）";
    case "capacity":
      return "⚠️ 当前模型繁忙！建议：1) 切换到 DeepSeek V3 2) 稍后重试 3) 检查 API 配额";
    case "timeout":
      return "⏱️ 请求超时（Thinking 模型响应较慢）。建议：1) 等待 30 秒后重试 2) 切换到更快的模型";
    case "network":
      return "🌐 网络连接失败，请检查：1) 网络连接 2) 代理设置 3) API 地址";
    case "auth":
      return "🔑 API 密钥无效，请在设置中检查 API Key 配置";
    case "cancelled":
      return "已停止";
    default:
      return error.message || "❌ 请求失败，请稍后重试";
  }
}
