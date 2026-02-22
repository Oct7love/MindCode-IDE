/**
 * 代码补全增强器
 * - 多模型融合
 * - 基于代码索引的上下文增强
 * - 智能缓存
 */

import type { CompletionRequest, CompletionResult } from "./completion-service";

// ============================================
// 多模型融合
// ============================================

/** 模型优先级配置 */
export interface ModelPriority {
  /** 模型名称 */
  model: string;
  /** 延迟权重（越低越好） */
  latencyWeight: number;
  /** 质量权重（越高越好） */
  qualityWeight: number;
  /** 超时时间 */
  timeout: number;
}

/** 默认模型优先级 */
export const DEFAULT_MODEL_PRIORITIES: ModelPriority[] = [
  { model: "claude-sonnet-4-5-20250929", latencyWeight: 1.0, qualityWeight: 0.9, timeout: 3000 },
  { model: "deepseek-coder", latencyWeight: 0.8, qualityWeight: 0.8, timeout: 2000 },
  { model: "claude-haiku-4-5-20251001", latencyWeight: 0.6, qualityWeight: 0.7, timeout: 1500 },
];

/**
 * 多模型融合补全
 * 同时请求多个模型，选择最佳结果
 */
export async function multiModelCompletion(
  request: CompletionRequest,
  callModel: (model: string, request: CompletionRequest) => Promise<CompletionResult>,
  priorities: ModelPriority[] = DEFAULT_MODEL_PRIORITIES,
): Promise<CompletionResult | null> {
  const startTime = Date.now();

  // 创建所有模型的请求
  const modelPromises = priorities.map(async (priority) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), priority.timeout);

    try {
      const result = await callModel(priority.model, request);
      clearTimeout(timeoutId);

      return {
        model: priority.model,
        result,
        latencyWeight: priority.latencyWeight,
        qualityWeight: priority.qualityWeight,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`[MultiModel] ${priority.model} 失败:`, err);
      return null;
    }
  });

  // 等待第一个成功的结果
  const results = await Promise.allSettled(modelPromises);

  // 过滤成功的结果
  const successResults = results
    .filter(
      (r): r is PromiseFulfilledResult<NonNullable<Awaited<(typeof modelPromises)[0]>>> =>
        r.status === "fulfilled" && r.value !== null,
    )
    .map((r) => r.value);

  if (successResults.length === 0) {
    return null;
  }

  // 如果只有一个结果，直接返回
  if (successResults.length === 1) {
    return successResults[0].result;
  }

  // 多个结果，选择最佳
  const bestResult = selectBestResult(successResults);

  if (process.env.NODE_ENV === "development")
    console.log(`[MultiModel] 选择 ${bestResult.model} 的结果，耗时 ${Date.now() - startTime}ms`);

  return bestResult.result;
}

/**
 * 选择最佳结果
 */
function selectBestResult(
  results: Array<{
    model: string;
    result: CompletionResult;
    latencyWeight: number;
    qualityWeight: number;
  }>,
): { model: string; result: CompletionResult } {
  // 计算综合得分
  const scored = results.map((r) => {
    // 延迟得分（越快越好）
    const latencyScore = Math.max(0, 1 - r.result.latencyMs / 3000);

    // 质量得分（候选数量和长度）
    const qualityScore =
      r.result.candidates.length > 0 ? Math.min(1, r.result.candidates[0].text.length / 100) : 0;

    // 综合得分
    const totalScore = (latencyScore * r.latencyWeight + qualityScore * r.qualityWeight) / 2;

    return { ...r, totalScore };
  });

  // 按得分排序
  scored.sort((a, b) => b.totalScore - a.totalScore);

  return scored[0];
}

// ============================================
// 上下文增强（基于代码索引）
// ============================================

/** 增强上下文 */
export interface EnhancedContext {
  /** 相关代码片段 */
  relatedCode: Array<{
    filePath: string;
    code: string;
    relevance: number;
  }>;
  /** 相关符号 */
  relatedSymbols: Array<{
    name: string;
    signature?: string;
    documentation?: string;
  }>;
  /** 最近使用的符号 */
  recentSymbols: string[];
}

/**
 * 获取增强上下文
 */
export async function getEnhancedContext(
  currentFile: string,
  cursorLine: number,
  codePrefix: string,
): Promise<EnhancedContext> {
  const context: EnhancedContext = {
    relatedCode: [],
    relatedSymbols: [],
    recentSymbols: [],
  };

  // 如果索引服务可用
  if (window.mindcode?.index) {
    try {
      // 提取光标前的关键词
      const keywords = extractKeywords(codePrefix);

      if (keywords.length > 0) {
        // 搜索相关代码
        const query = keywords.slice(-3).join(" ");
        const relatedResult = await window.mindcode.index.getRelatedCode(query, 5);

        if (relatedResult.success && relatedResult.data) {
          context.relatedCode = relatedResult.data;
        }

        // 搜索相关符号
        const lastKeyword = keywords[keywords.length - 1];
        const symbolResult = await window.mindcode.index.searchSymbols(lastKeyword, 10);

        if (symbolResult.success && symbolResult.data) {
          context.relatedSymbols = symbolResult.data.map(
            (s: { name: string; signature?: string; documentation?: string }) => ({
              name: s.name,
              signature: s.signature,
              documentation: s.documentation,
            }),
          );
        }
      }
    } catch (err) {
      console.warn("[CompletionEnhancer] 获取增强上下文失败:", err);
    }
  }

  return context;
}

/**
 * 提取关键词
 */
function extractKeywords(code: string): string[] {
  // 取最后 200 个字符
  const recent = code.slice(-200);

  // 提取标识符
  const identifiers = recent.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];

  // 过滤常见关键字
  const keywords = [
    "function",
    "const",
    "let",
    "var",
    "if",
    "else",
    "for",
    "while",
    "return",
    "import",
    "export",
    "from",
    "class",
    "interface",
    "type",
    "async",
    "await",
  ];

  return identifiers.filter((id) => !keywords.includes(id) && id.length > 2);
}

/**
 * 格式化增强上下文为提示词
 */
export function formatEnhancedContext(context: EnhancedContext): string {
  const parts: string[] = [];

  // 相关符号
  if (context.relatedSymbols.length > 0) {
    parts.push("// 项目中的相关符号：");
    for (const sym of context.relatedSymbols.slice(0, 5)) {
      if (sym.signature) {
        parts.push(`// - ${sym.signature}`);
      } else {
        parts.push(`// - ${sym.name}`);
      }
    }
    parts.push("");
  }

  // 相关代码（简化）
  if (context.relatedCode.length > 0) {
    parts.push("// 相关代码片段：");
    for (const snippet of context.relatedCode.slice(0, 2)) {
      const shortCode = snippet.code.split("\n").slice(0, 5).join("\n");
      parts.push(`// --- ${snippet.filePath} ---`);
      parts.push(
        shortCode
          .split("\n")
          .map((l) => `// ${l}`)
          .join("\n"),
      );
    }
    parts.push("");
  }

  return parts.join("\n");
}

// ============================================
// 智能缓存
// ============================================

interface CacheEntry {
  result: CompletionResult;
  timestamp: number;
  hitCount: number;
  contextHash: string;
}

/** 补全缓存 */
export class CompletionCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private maxAge: number;

  constructor(maxSize = 100, maxAge = 30000) {
    this.maxSize = maxSize;
    this.maxAge = maxAge;
  }

  /**
   * 生成缓存键
   */
  private generateKey(request: CompletionRequest): string {
    // 使用文件路径 + 光标位置 + 代码前缀哈希
    const prefixEnd = request.code.indexOf(
      "\n",
      request.code.lastIndexOf("\n", request.cursorColumn - 1),
    );
    const prefix = request.code.substring(0, prefixEnd > 0 ? prefixEnd : request.cursorColumn);
    const prefixHash = this.simpleHash(prefix.slice(-200));

    return `${request.filePath}:${request.cursorLine}:${prefixHash}`;
  }

  /**
   * 简单哈希
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  /**
   * 获取缓存
   */
  get(request: CompletionRequest): CompletionResult | null {
    const key = this.generateKey(request);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    // 增加命中计数
    entry.hitCount++;

    // 标记为缓存命中
    return { ...entry.result, cached: true };
  }

  /**
   * 设置缓存
   */
  set(request: CompletionRequest, result: CompletionResult): void {
    const key = this.generateKey(request);

    // 如果达到最大容量，删除最旧的
    if (this.cache.size >= this.maxSize) {
      const oldest = this.findOldest();
      if (oldest) this.cache.delete(oldest);
    }

    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      hitCount: 0,
      contextHash: key,
    });
  }

  /**
   * 查找最旧的条目
   */
  private findOldest(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache) {
      // 考虑命中次数，经常使用的保留更久
      const adjustedTime = entry.timestamp + entry.hitCount * 1000;
      if (adjustedTime < oldestTime) {
        oldestTime = adjustedTime;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取统计
   */
  getStats(): { size: number; hitRate: number } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount;
    }

    return {
      size: this.cache.size,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }
}

// 全局缓存实例
export const completionCache = new CompletionCache();

// ============================================
// 补全质量提升
// ============================================

/**
 * 验证补全结果
 * 检查是否有语法错误等
 */
export function validateCompletion(
  completion: string,
  language: string,
): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // 检查括号匹配
  const brackets: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];

  for (const char of completion) {
    if (char in brackets) {
      stack.push(brackets[char]);
    } else if (Object.values(brackets).includes(char)) {
      if (stack.pop() !== char) {
        issues.push("括号不匹配");
        break;
      }
    }
  }

  if (stack.length > 0) {
    // 未闭合的括号，这可能是正常的（用户还没写完）
    // 不算错误，只是提示
  }

  // 检查明显的语法错误模式
  const errorPatterns = [
    /\.\.\./g, // 省略号（可能是模板残留）
    /TODO:|FIXME:/g, // 未完成标记
    /undefined|null(?!ish)/g, // 可能的类型错误
  ];

  for (const pattern of errorPatterns) {
    if (pattern.test(completion)) {
      // 只是警告，不算无效
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * 自动添加导入语句
 */
export function suggestImports(
  completion: string,
  existingImports: string[],
  relatedSymbols: Array<{ name: string; importSource?: string }>,
): string[] {
  const suggestions: string[] = [];

  // 提取补全中使用的标识符
  const usedIdentifiers = new Set(completion.match(/[A-Z][a-zA-Z0-9]*/g) || []);

  // 检查是否需要导入
  for (const identifier of usedIdentifiers) {
    // 检查是否已导入
    const isImported = existingImports.some((imp) => imp.includes(identifier));
    if (isImported) continue;

    // 查找可能的导入源
    const symbol = relatedSymbols.find((s) => s.name === identifier && s.importSource);
    if (symbol && symbol.importSource) {
      suggestions.push(`import { ${identifier} } from '${symbol.importSource}';`);
    }
  }

  return suggestions;
}
