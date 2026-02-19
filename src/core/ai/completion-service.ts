/**
 * Cursor-like Inline Completion Service
 *
 * 完整的代码补全服务实现
 * - 上下文提取
 * - 提示词生成
 * - 模型调用
 * - 结果处理
 */

import {
  CompletionModelConfig,
  CompletionRequestConfig,
  DEFAULT_COMPLETION_REQUEST_CONFIG,
  getModelConfig,
} from "./completion-config";
import { logger } from "../logger";

const log = logger.child("Completion");

import { CompletionContext, DiagnosticInfo, buildCompletionContext } from "./completion-context";

import type { PromptGeneratorOptions } from "./completion-prompt";
import {
  generateCompletionMessages,
  cleanCompletionOutput,
  parseMultiCandidateOutput,
  hasOverlapWithSuffix,
  truncateCompletion,
} from "./completion-prompt";

// ============================================
// 类型定义
// ============================================

export interface CompletionCandidate {
  text: string;
  score: number;
  range?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface CompletionResult {
  candidates: CompletionCandidate[];
  context: CompletionContext;
  latencyMs: number;
  cached: boolean;
}

export interface CompletionRequest {
  filePath: string;
  code: string;
  cursorLine: number;
  cursorColumn: number;
  triggerKind?: "auto" | "manual" | "retrigger";
  triggerCharacter?: string;
}

export type ModelCallFn = (
  messages: Array<{ role: "system" | "user"; content: string }>,
  config: CompletionModelConfig,
) => Promise<string>;

// ============================================
// 补全服务
// ============================================

export class CompletionService {
  private config: CompletionRequestConfig;
  private modelName: string;
  private modelCallFn: ModelCallFn;
  private promptOptions: PromptGeneratorOptions;

  // 缓存
  private cache: Map<string, { result: CompletionResult; timestamp: number }>;
  private cacheMaxAge: number = 5000; // 5s 缓存

  // 防抖
  private debounceTimer: NodeJS.Timeout | null = null;
  private pendingRequest: {
    resolve: (r: CompletionResult | null) => void;
    reject: (e: Error) => void;
  } | null = null;

  // 取消
  private abortController: AbortController | null = null;

  constructor(
    modelName: string,
    modelCallFn: ModelCallFn,
    config: Partial<CompletionRequestConfig> = {},
    promptOptions: PromptGeneratorOptions = {},
  ) {
    this.modelName = modelName;
    this.modelCallFn = modelCallFn;
    this.config = { ...DEFAULT_COMPLETION_REQUEST_CONFIG, ...config };
    this.promptOptions = promptOptions;
    this.cache = new Map();
  }

  /**
   * 请求补全（带防抖）
   */
  async requestCompletion(request: CompletionRequest): Promise<CompletionResult | null> {
    // 取消之前的请求
    this.cancelPending();

    return new Promise((resolve, reject) => {
      this.pendingRequest = { resolve, reject };

      this.debounceTimer = setTimeout(async () => {
        try {
          const result = await this.doCompletion(request);
          this.pendingRequest?.resolve(result);
        } catch (error) {
          this.pendingRequest?.reject(error as Error);
        } finally {
          this.pendingRequest = null;
        }
      }, this.config.debounceMs);
    });
  }

  /**
   * 立即请求补全（无防抖）
   */
  async requestCompletionImmediate(request: CompletionRequest): Promise<CompletionResult | null> {
    this.cancelPending();
    return this.doCompletion(request);
  }

  /**
   * 取消待处理的请求
   */
  cancelPending(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (this.pendingRequest) {
      this.pendingRequest.resolve(null);
      this.pendingRequest = null;
    }
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * 执行补全
   */
  private async doCompletion(request: CompletionRequest): Promise<CompletionResult | null> {
    const startTime = Date.now();

    // 检查缓存
    const cacheKey = this.getCacheKey(request);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheMaxAge) {
      return { ...cached.result, cached: true };
    }

    // 构建上下文
    const context = await buildCompletionContext(
      request.filePath,
      request.code,
      request.cursorLine,
      request.cursorColumn,
      {
        maxPrefixLines: this.config.maxPrefixLines,
        maxSuffixLines: this.config.maxSuffixLines,
      },
    );

    context.triggerKind = request.triggerKind || "auto";
    context.triggerCharacter = request.triggerCharacter;

    // 检查是否应该补全
    if (!this.shouldComplete(context)) {
      return null;
    }

    // 生成提示词
    const messages = generateCompletionMessages(context, {
      ...this.promptOptions,
      multiCandidate: this.config.multiCandidate,
      useFIM: this.config.useFIM,
    });

    // 获取模型配置
    const modelConfig = getModelConfig(this.modelName);

    // 创建 abort controller
    this.abortController = new AbortController();

    try {
      // 调用模型
      const response = await Promise.race([
        this.modelCallFn(messages, modelConfig),
        this.timeout(this.config.timeoutMs),
      ]);

      if (!response) {
        return null;
      }

      // 解析结果
      const candidates = this.config.multiCandidate
        ? parseMultiCandidateOutput(response)
        : [{ text: cleanCompletionOutput(response), score: 1.0 }];

      // 后处理
      const processedCandidates = candidates
        .map((c) => ({
          ...c,
          text: truncateCompletion(c.text),
        }))
        .filter((c) => c.text.length > 0)
        .filter((c) => !hasOverlapWithSuffix(c.text, context.suffix));

      const result: CompletionResult = {
        candidates: processedCandidates,
        context,
        latencyMs: Date.now() - startTime,
        cached: false,
      };

      // 存入缓存
      this.cache.set(cacheKey, { result, timestamp: Date.now() });

      // 清理过期缓存
      this.cleanCache();

      return result;
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return null;
      }
      throw error;
    }
  }

  /**
   * 判断是否应该触发补全
   */
  private shouldComplete(context: CompletionContext): boolean {
    const { currentLine, cursor } = context;
    const lineBeforeCursor = currentLine.substring(0, cursor.column - 1);
    const trimmed = lineBeforeCursor.trim();

    // 空行不补全
    if (trimmed.length === 0) {
      return false;
    }

    // 注释中不自动补全（除非手动触发）
    if (context.triggerKind === "auto") {
      const commentPatterns = ["//", "#", "/*", "*", '"""', "'''"];
      for (const pattern of commentPatterns) {
        if (trimmed.startsWith(pattern)) {
          return false;
        }
      }
    }

    // 字符串中间不补全
    const quoteCount = (lineBeforeCursor.match(/"/g) || []).length;
    const singleQuoteCount = (lineBeforeCursor.match(/'/g) || []).length;
    if (quoteCount % 2 !== 0 || singleQuoteCount % 2 !== 0) {
      // 在字符串中，只有手动触发才补全
      if (context.triggerKind !== "manual") {
        return false;
      }
    }

    return true;
  }

  /**
   * 生成缓存 key
   */
  private getCacheKey(request: CompletionRequest): string {
    return `${request.filePath}:${request.cursorLine}:${request.cursorColumn}:${request.code.length}`;
  }

  /**
   * 清理过期缓存
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheMaxAge) {
        this.cache.delete(key);
      }
    }

    // 限制缓存大小
    if (this.cache.size > 100) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      for (let i = 0; i < entries.length - 50; i++) {
        this.cache.delete(entries[i][0]);
      }
    }
  }

  /**
   * 超时 Promise
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error("Completion timeout"));
      }, ms);
    });
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<CompletionRequestConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 切换模型
   */
  setModel(modelName: string, modelCallFn?: ModelCallFn): void {
    this.modelName = modelName;
    if (modelCallFn) {
      this.modelCallFn = modelCallFn;
    }
    this.clearCache();
  }
}

// ============================================
// Monaco 集成
// ============================================

/**
 * 创建 Monaco InlineCompletionProvider
 */
export function createMonacoCompletionProvider(service: CompletionService, monaco: any): any {
  return {
    provideInlineCompletions: async (model: any, position: any, context: any, token: any) => {
      // 检查取消
      if (token.isCancellationRequested) {
        return { items: [] };
      }

      const request: CompletionRequest = {
        filePath: model.uri.path,
        code: model.getValue(),
        cursorLine: position.lineNumber - 1,
        cursorColumn: position.column,
        triggerKind: context.triggerKind === 1 ? "auto" : "manual",
      };

      try {
        const result = await service.requestCompletion(request);

        if (!result || result.candidates.length === 0) {
          return { items: [] };
        }

        return {
          items: result.candidates.map((candidate) => ({
            insertText: candidate.text,
            range: new monaco.Range(
              position.lineNumber,
              position.column,
              position.lineNumber,
              position.column,
            ),
            // 可选：命令（接受后执行）
            // command: { id: 'editor.action.inlineSuggest.commit' }
          })),
        };
      } catch (error) {
        log.error("Completion error:", error);
        return { items: [] };
      }
    },

    freeInlineCompletions: () => {
      // 清理资源（如有需要）
    },
  };
}

// ============================================
// 导出
// ============================================

export { CompletionModelConfig, CompletionRequestConfig, CompletionContext, DiagnosticInfo };
