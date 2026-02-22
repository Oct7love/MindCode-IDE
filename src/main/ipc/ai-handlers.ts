/**
 * AI IPC Handlers
 *
 * 处理 AI 聊天、流式对话、代码补全等 AI 相关的 IPC 请求。
 * 使用 LLM 客户端统一管理多个 AI Provider。
 */
import { ipcMain } from "electron";
import { ClaudeProvider } from "../../core/ai/providers/claude";
import { OpenAIProvider } from "../../core/ai/providers/openai";
import { DeepSeekProvider } from "../../core/ai/providers/deepseek";
import { GeminiProvider } from "../../core/ai/providers/gemini";
import { GLMProvider } from "../../core/ai/providers/glm";
import { CodesucProvider } from "../../core/ai/providers/codesuc";
import { defaultAIConfig } from "../../core/ai/config";
import { LLMClient, getUserFriendlyError } from "../../core/ai/llm-client";
import { markStartup } from "../../core/performance";
import { warmupConnections, StreamBuffer } from "../../core/ai/request-optimizer";
import { getRequestPipeline } from "../../core/ai/request-pipeline";
import {
  generateCompletionMessages,
  cleanCompletionOutput,
  truncateCompletion,
} from "../../core/ai/completion-prompt";
import { buildCompletionContext } from "../../core/ai/completion-context";
import { DEFAULT_COMPLETION_REQUEST_CONFIG } from "../../core/ai/completion-config";
import { completionCache as perfCompletionCache } from "../../core/performance";
import type { AIProvider } from "../../shared/types/ai";
import type { IPCContext } from "./types";

/** AI 并发请求限制 */
const AI_MAX_CONCURRENT = 2;

/** 流式缓冲区间隔（ms） */
const STREAM_BUFFER_INTERVAL_MS = 16;

/** 补全缓存 TTL（ms） */
const _COMPLETION_CACHE_TTL_MS = 30000;

/** 补全上下文回溯行数 */
const COMPLETION_CONTEXT_LINES = 5;

/** 补全缓存 key 最大长度 */
const CACHE_KEY_SUFFIX_LENGTH = 200;

/** 补全结果截断参数 */
const COMPLETION_MAX_LINES = 20;
const COMPLETION_MAX_CHARS = 2000;

/** 快速模型超时（ms） */
const FAST_MODEL_TIMEOUT_MS = 2000;

// 初始化请求管道
const aiPipeline = getRequestPipeline();
aiPipeline.setMaxConcurrent(AI_MAX_CONCURRENT);

/** 活跃流式请求跟踪（用于取消） */
const activeStreams = new Map<string, { buffer: StreamBuffer; cancelled: boolean }>();

// 懒加载 AI Providers
let _providers: Record<string, AIProvider> | null = null;
let _llmClient: LLMClient | null = null;

function getProviders(): Record<string, AIProvider> {
  if (!_providers) {
    markStartup("providers_init_start");
    _providers = {
      claude: new ClaudeProvider({
        apiKey: defaultAIConfig.claude.apiKey,
        baseUrl: defaultAIConfig.claude.baseUrl,
        model: defaultAIConfig.claude.model,
      }),
      openai: new OpenAIProvider({
        apiKey: defaultAIConfig.openai.apiKey,
        baseUrl: defaultAIConfig.openai.baseUrl,
        model: defaultAIConfig.openai.model,
      }),
      gpt4: new OpenAIProvider({
        apiKey: defaultAIConfig.openai.apiKey,
        baseUrl: defaultAIConfig.openai.baseUrl,
        model: defaultAIConfig.openai.model,
      }),
      gemini: new GeminiProvider({
        apiKey: defaultAIConfig.gemini.apiKey,
        baseUrl: defaultAIConfig.gemini.baseUrl,
        model: defaultAIConfig.gemini.model,
      }),
      deepseek: new DeepSeekProvider({
        apiKey: defaultAIConfig.deepseek.apiKey,
        baseUrl: defaultAIConfig.deepseek.baseUrl,
        model: defaultAIConfig.deepseek.model,
      }),
      glm: new GLMProvider({
        apiKey: defaultAIConfig.glm.apiKey,
        baseUrl: defaultAIConfig.glm.baseUrl,
        model: defaultAIConfig.glm.model,
      }),
      codesuc: new CodesucProvider({
        apiKey: defaultAIConfig.codesuc.apiKey,
        baseUrl: defaultAIConfig.codesuc.baseUrl,
        model: defaultAIConfig.codesuc.model,
      }),
    };
    markStartup("providers_init_end");
    // 后台探测能力（不阻塞）
    (_providers.codesuc as CodesucProvider).probeCapabilities().catch(() => {});
  }
  return _providers;
}

function getLLMClient(): LLMClient {
  if (!_llmClient) {
    const providers = getProviders();
    _llmClient = new LLMClient(new Map(Object.entries(providers)));
  }
  return _llmClient;
}

/** 根据模型名选择 Provider */
function getProviderForModel(model: string): AIProvider {
  const providers = getProviders();
  if (model.startsWith("codesuc-")) return providers.codesuc;
  if (model.startsWith("claude-")) return providers.claude;
  if (model.startsWith("gemini-")) return providers.gemini;
  if (model.startsWith("deepseek-")) return providers.deepseek;
  if (model.startsWith("glm-")) return providers.glm;
  if (model.startsWith("gpt-")) return providers.openai;
  return providers.claude;
}

/** 预热 Provider 和连接 */
export function warmupAIProviders(): void {
  Promise.resolve().then(() => {
    getProviders();
    markStartup("providers_preloaded");
    warmupConnections().then(() => markStartup("connections_warmed"));
  });
}

export function registerAIHandlers(_ctx: IPCContext): void {
  // AI 聊天（非流式）
  ipcMain.handle("ai-chat", async (_event, { model, messages }) => {
    const result = await aiPipeline.add(() => getLLMClient().chat({ model, messages }), 1);
    if (result.success) {
      return {
        success: true,
        data: result.data,
        model: result.model,
        usedFallback: result.usedFallback,
      };
    }
    return {
      success: false,
      error: getUserFriendlyError(result.error!),
      errorType: result.error?.type,
    };
  });

  // AI 聊天（流式）
  ipcMain.on("ai-chat-stream", async (event, { model, messages, requestId }) => {
    const streamState = { buffer: null as unknown as StreamBuffer, cancelled: false };
    const buffer = new StreamBuffer((text) => {
      if (!streamState.cancelled) {
        event.sender.send("ai-stream-token", { requestId, token: text });
      }
    }, STREAM_BUFFER_INTERVAL_MS);
    streamState.buffer = buffer;
    activeStreams.set(requestId, streamState);

    aiPipeline
      .add(
        () =>
          getLLMClient().chatStream(
            { model, messages },
            {
              onToken: (token) => {
                if (streamState.cancelled) return;
                buffer.push(token);
              },
              onComplete: (fullText, meta) => {
                buffer.destroy();
                activeStreams.delete(requestId);
                if (!streamState.cancelled) {
                  event.sender.send("ai-stream-complete", {
                    requestId,
                    fullText,
                    model: meta.model,
                    usedFallback: meta.usedFallback,
                  });
                }
              },
              onError: (error) => {
                buffer.destroy();
                activeStreams.delete(requestId);
                if (!streamState.cancelled) {
                  event.sender.send("ai-stream-error", {
                    requestId,
                    error: getUserFriendlyError(error),
                    errorType: error.type,
                  });
                }
              },
              onFallback: (from, to) => {
                if (!streamState.cancelled) {
                  event.sender.send("ai-stream-fallback", { requestId, from, to });
                }
              },
            },
          ),
        2, // 流式请求高优先级
      )
      .catch((e) => {
        buffer.destroy();
        activeStreams.delete(requestId);
        if (!streamState.cancelled) {
          event.sender.send("ai-stream-error", {
            requestId,
            error: (e as Error)?.message || "Request failed",
            errorType: "unknown",
          });
        }
      });
  });

  // AI 聊天（流式 + 工具调用）
  ipcMain.on("ai-chat-stream-with-tools", async (event, { model, messages, tools, requestId }) => {
    const streamState = { buffer: null as unknown as StreamBuffer, cancelled: false };
    const buffer = new StreamBuffer((text) => {
      if (!streamState.cancelled) {
        event.sender.send("ai-stream-token", { requestId, token: text });
      }
    }, STREAM_BUFFER_INTERVAL_MS);
    streamState.buffer = buffer;
    activeStreams.set(requestId, streamState);

    try {
      await getLLMClient().chatStream(
        { model, messages, tools },
        {
          onToken: (token) => {
            if (streamState.cancelled) return;
            buffer.push(token);
          },
          onToolCall: (calls) => {
            if (!streamState.cancelled) {
              event.sender.send("ai-stream-tool-call", { requestId, toolCalls: calls });
            }
          },
          onComplete: (fullText, meta) => {
            buffer.destroy();
            activeStreams.delete(requestId);
            if (!streamState.cancelled) {
              event.sender.send("ai-stream-complete", {
                requestId,
                fullText,
                model: meta.model,
                usedFallback: meta.usedFallback,
              });
            }
          },
          onError: (error) => {
            buffer.destroy();
            activeStreams.delete(requestId);
            if (!streamState.cancelled) {
              event.sender.send("ai-stream-error", {
                requestId,
                error: getUserFriendlyError(error),
                errorType: error.type,
              });
            }
          },
          onFallback: (from, to) => {
            if (!streamState.cancelled) {
              event.sender.send("ai-stream-fallback", { requestId, from, to });
            }
          },
        },
      );
    } catch (e) {
      buffer.destroy();
      activeStreams.delete(requestId);
      if (!streamState.cancelled) {
        event.sender.send("ai-stream-error", {
          requestId,
          error: (e as Error)?.message || "Request failed",
          errorType: "unknown",
        });
      }
    }
  });

  // LLM 状态查询
  ipcMain.handle("ai-stats", () => getLLMClient().getStats());

  // AI 流式请求取消
  ipcMain.on("ai-stream-cancel", (_event, { requestId }: { requestId: string }) => {
    const stream = activeStreams.get(requestId);
    if (stream) {
      stream.cancelled = true;
      stream.buffer.destroy();
      activeStreams.delete(requestId);
    }
  });

  // 代码补全
  ipcMain.handle(
    "ai:completion",
    async (
      _event,
      request: {
        filePath: string;
        code: string;
        cursorLine: number;
        cursorColumn: number;
        model?: string;
      },
    ) => {
      const {
        filePath,
        code,
        cursorLine,
        cursorColumn,
        model = "claude-sonnet-4-5-20250929",
      } = request;
      const _start = Date.now();

      // 生成缓存 key
      const prefix = code
        .split("\n")
        .slice(Math.max(0, cursorLine - COMPLETION_CONTEXT_LINES), cursorLine)
        .join("\n");
      const cacheKey = `${model}:${filePath}:${cursorLine}:${prefix.slice(-CACHE_KEY_SUFFIX_LENGTH)}`;

      // 检查缓存
      const cached = perfCompletionCache.get(cacheKey);
      if (cached) {
        return { success: true, data: cached, cached: true };
      }

      try {
        const context = await buildCompletionContext(filePath, code, cursorLine, cursorColumn, {
          maxPrefixLines: DEFAULT_COMPLETION_REQUEST_CONFIG.maxPrefixLines,
          maxSuffixLines: DEFAULT_COMPLETION_REQUEST_CONFIG.maxSuffixLines,
        });

        const messages = generateCompletionMessages(context, {
          useFIM: true,
          includeSymbols: true,
          includeDiagnostics: false,
          includeRelatedSnippets: true,
          includeStyleHints: true,
        });

        // 多模型并行补全
        const fastModel = "claude-haiku-4-5-20251001";
        const primaryModel = model;
        const useDualModel = primaryModel !== fastModel;

        if (useDualModel) {
          const fastPromise = (async () => {
            try {
              const p = getProviderForModel(fastModel);
              const r = await Promise.race([
                p.setModel(fastModel).chat(messages),
                new Promise<null>((_, reject) =>
                  setTimeout(() => reject(new Error("timeout")), FAST_MODEL_TIMEOUT_MS),
                ),
              ]);
              return r ? { model: fastModel, response: r } : null;
            } catch {
              return null;
            }
          })();

          const primaryPromise = (async () => {
            try {
              const p = getProviderForModel(primaryModel);
              const r = await p.setModel(primaryModel).chat(messages);
              return { model: primaryModel, response: r };
            } catch {
              return null;
            }
          })();

          const winner = await Promise.race(
            [fastPromise.then((r) => (r ? r : primaryPromise)), primaryPromise].filter(Boolean),
          );

          if (winner && winner.response) {
            const cleaned = cleanCompletionOutput(winner.response);
            const result = truncateCompletion(cleaned, COMPLETION_MAX_LINES, COMPLETION_MAX_CHARS);
            perfCompletionCache.set(cacheKey, result);
            return { success: true, data: result, cached: false, model: winner.model };
          }

          return { success: false, error: "All models returned no results" };
        }

        // 单模型回退
        const provider = getProviderForModel(model);
        const response = await provider.setModel(model).chat(messages);
        const cleaned = cleanCompletionOutput(response);
        const result = truncateCompletion(cleaned, COMPLETION_MAX_LINES, COMPLETION_MAX_CHARS);
        perfCompletionCache.set(cacheKey, result);
        return { success: true, data: result, cached: false };
      } catch (error: unknown) {
        return { success: false, error: (error as Error)?.message || "Completion failed" };
      }
    },
  );

  // 流式代码补全
  ipcMain.on(
    "ai:completion-stream",
    async (
      event,
      request: {
        filePath: string;
        code: string;
        cursorLine: number;
        cursorColumn: number;
        model?: string;
        requestId: string;
      },
    ) => {
      const {
        filePath,
        code,
        cursorLine,
        cursorColumn,
        model = "claude-sonnet-4-5-20250929",
        requestId,
      } = request;

      // 检查缓存
      const prefix = code
        .split("\n")
        .slice(Math.max(0, cursorLine - COMPLETION_CONTEXT_LINES), cursorLine)
        .join("\n");
      const cacheKey = `${model}:${filePath}:${cursorLine}:${prefix.slice(-CACHE_KEY_SUFFIX_LENGTH)}`;
      const cached = perfCompletionCache.get(cacheKey);
      if (cached) {
        event.sender.send("ai:completion-stream-token", { requestId, token: cached });
        event.sender.send("ai:completion-stream-done", {
          requestId,
          fullText: cached,
          cached: true,
        });
        return;
      }

      try {
        const context = await buildCompletionContext(filePath, code, cursorLine, cursorColumn, {
          maxPrefixLines: DEFAULT_COMPLETION_REQUEST_CONFIG.maxPrefixLines,
          maxSuffixLines: DEFAULT_COMPLETION_REQUEST_CONFIG.maxSuffixLines,
        });

        const messages = generateCompletionMessages(context, {
          useFIM: true,
          includeSymbols: true,
          includeDiagnostics: false,
          includeRelatedSnippets: true,
          includeStyleHints: true,
        });

        const provider = getProviderForModel(model);
        let fullText = "";

        const buffer = new StreamBuffer((chunk: string) => {
          event.sender.send("ai:completion-stream-token", { requestId, token: chunk });
        }, STREAM_BUFFER_INTERVAL_MS);

        await provider.setModel(model).chatStream(messages, {
          onToken: (token: string) => {
            fullText += token;
            buffer.push(token);
          },
          onComplete: () => {
            buffer.flush();
            buffer.destroy();
            const cleaned = cleanCompletionOutput(fullText);
            const result = truncateCompletion(cleaned, COMPLETION_MAX_LINES, COMPLETION_MAX_CHARS);
            perfCompletionCache.set(cacheKey, result);
            event.sender.send("ai:completion-stream-done", {
              requestId,
              fullText: result,
              cached: false,
            });
          },
          onError: (err: any) => {
            buffer.destroy();
            event.sender.send("ai:completion-stream-error", {
              requestId,
              error: err?.message || "Stream failed",
            });
          },
        });
      } catch (e: any) {
        event.sender.send("ai:completion-stream-error", {
          requestId,
          error: e?.message || "Completion stream failed",
        });
      }
    },
  );
}
