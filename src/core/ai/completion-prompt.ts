/**
 * Cursor-like Inline Completion 提示词生成器
 *
 * 将 CompletionContext 转换为模型可用的提示词
 */

import type { CompletionContext } from "./completion-context";
import {
  formatSymbolsForPrompt,
  formatDiagnosticsForPrompt,
  formatStyleHintsForPrompt,
  formatRelatedSnippetsForPrompt,
} from "./completion-context";
import type { IntentResult } from "./intent-classifier";
import { getIntentPromptModifier } from "./intent-classifier";

// ============================================
// System Prompts
// ============================================

/**
 * 单候选 System Prompt（基础版）
 */
export const COMPLETION_SYSTEM_PROMPT_BASE = `你是一个 IDE 的"行内代码补全引擎"（inline completion / ghost text）。
你的任务：根据光标位置与上下文，生成**最可能**被用户马上接受的代码补全。

严格规则：
- 你只能输出"应插入光标处的补全文本"，不要输出任何解释、标题、Markdown、代码块围栏。
- 保持与上下文一致的：语言、缩进、命名、代码风格、错误处理方式、导入风格。
- 不要重复下方（suffix）已存在的内容；如将重复，请缩短或改为更贴合的下一步。
- 优先生成可编译/可运行的代码；若上下文不足，生成短补全（1~3行）。
- 默认不新增 imports；只有在上下文明确已有该依赖/惯例且缺失会导致明显错误时，才以最小方式补全（优先使用已有导入风格）。
- 遇到疑似密钥/Token/私密信息：不要输出真实值；仅输出占位符（例如 process.env.X、"<REDACTED>"、os.getenv("X")）。
- 保持"高置信优先"：不确定就短，不要胡编 API。

输出格式规则：
- 只输出补全文本本身（plain text）。
- 不要包含 <CURSOR> 字样；不要输出前缀/后缀；只输出插入内容。
- 如果最合理的补全是"什么都不补"，输出空字符串。`;

/**
 * 根据意图生成 System Prompt
 */
export function getCompletionSystemPrompt(intent?: IntentResult): string {
  let prompt = COMPLETION_SYSTEM_PROMPT_BASE;

  if (intent && intent.confidence > 0.3) {
    const modifier = getIntentPromptModifier(intent);
    prompt += `\n\n${modifier}`;

    // 根据意图调整最大行数
    switch (intent.type) {
      case "generate":
        prompt += "\n- 可以生成较长的完整实现（最多 30 行）。";
        break;
      case "test":
        prompt += "\n- 可以生成完整的测试用例（最多 50 行）。";
        break;
      case "fix":
        prompt += "\n- 保持最小改动，只修复必要的部分。";
        break;
      case "refactor":
        prompt += "\n- 可以进行较大范围的重构（最多 40 行）。";
        break;
    }
  }

  return prompt;
}

/**
 * 兼容旧版：单候选 System Prompt
 */
export const COMPLETION_SYSTEM_PROMPT = COMPLETION_SYSTEM_PROMPT_BASE;

/**
 * 多候选 System Prompt
 */
export const COMPLETION_MULTI_CANDIDATE_SYSTEM_PROMPT = `你是 IDE 行内代码补全引擎，需要输出最多 3 个候选补全，按概率从高到低排序。

输出必须是严格 JSON（不要 Markdown）：
{
  "candidates": [
    {"text": "...", "score": 0.95},
    {"text": "...", "score": 0.7},
    {"text": "...", "score": 0.5}
  ]
}

规则：
- score ∈ [0,1]，单调递减
- text 仅包含插入内容（纯文本）
- 候选差异要有意义（长度/策略/是否补全错误处理）
- 最多 3 个，最少 1 个；若无补全则 candidates 为空数组
- 保持与上下文一致的语言、缩进、命名、代码风格
- 不要重复 suffix 已存在的内容
- 不要胡编 API，不确定就短
- 疑似密钥用占位符`;

/**
 * FIM System Prompt
 */
export const COMPLETION_FIM_SYSTEM_PROMPT = `你是代码补全引擎。请完成 <MIDDLE>，使整体代码最自然可用。

规则：
- 只输出 <MIDDLE> 的内容（纯文本），不要解释，不要 Markdown
- 保持与上下文一致的语言、缩进、命名、代码风格
- 不要重复 <SUFFIX> 已存在的内容
- 不确定就短（1~3行），最多 20 行
- 疑似密钥用占位符`;

// ============================================
// 提示词生成
// ============================================

export interface PromptGeneratorOptions {
  /** 使用 FIM 格式 */
  useFIM?: boolean;
  /** 多候选模式 */
  multiCandidate?: boolean;
  /** 包含符号 */
  includeSymbols?: boolean;
  /** 包含诊断 */
  includeDiagnostics?: boolean;
  /** 包含相关片段 */
  includeRelatedSnippets?: boolean;
  /** 包含风格提示 */
  includeStyleHints?: boolean;
  /** 最大符号数 */
  maxSymbols?: number;
}

const DEFAULT_OPTIONS: PromptGeneratorOptions = {
  useFIM: true,
  multiCandidate: false,
  includeSymbols: true,
  includeDiagnostics: true,
  includeRelatedSnippets: true,
  includeStyleHints: true,
  maxSymbols: 30,
};

/**
 * 生成标准格式的 User Prompt
 */
export function generateUserPrompt(
  context: CompletionContext,
  options: PromptGeneratorOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const parts: string[] = [];

  // 基础信息
  parts.push(`LANGUAGE: ${context.language}`);
  parts.push(`FILE: ${context.filePath}`);
  parts.push("");

  // 风格提示
  if (opts.includeStyleHints) {
    parts.push("STYLE_HINTS:");
    parts.push(formatStyleHintsForPrompt(context.styleHints));
    parts.push("");
  }

  // 诊断
  if (opts.includeDiagnostics && context.diagnostics.length > 0) {
    parts.push("DIAGNOSTICS:");
    parts.push(formatDiagnosticsForPrompt(context.diagnostics));
    parts.push("");
  }

  // 符号
  if (opts.includeSymbols && context.symbols.length > 0) {
    parts.push("AVAILABLE_SYMBOLS:");
    parts.push(formatSymbolsForPrompt(context.symbols, opts.maxSymbols));
    parts.push("");
  }

  // 相关片段
  if (opts.includeRelatedSnippets && context.relatedSnippets.length > 0) {
    parts.push("RELATED_SNIPPETS:");
    parts.push(formatRelatedSnippetsForPrompt(context.relatedSnippets));
    parts.push("");
  }

  // 用户意图
  if (context.userIntent || context.intent) {
    parts.push("USER_INTENT:");
    if (context.userIntent) {
      parts.push(context.userIntent);
    }
    if (context.intent && context.intent.confidence > 0.3) {
      parts.push(`[${context.intent.description}] ${context.intent.suggestedAction || ""}`);
    }
    parts.push("");
  }

  // 代码
  parts.push("CODE (prefix + cursor + suffix):");
  parts.push(context.prefix);
  parts.push("<CURSOR>");
  parts.push(context.suffix);
  parts.push("");

  // 指令
  parts.push('请生成应插入 <CURSOR> 处的"最优补全"，遵循 system 规则，仅输出补全文本。');

  return parts.join("\n");
}

/**
 * 生成 FIM 格式的 User Prompt
 */
export function generateFIMPrompt(
  context: CompletionContext,
  options: PromptGeneratorOptions = {},
): string {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const parts: string[] = [];

  parts.push("你是代码补全引擎。请完成 <MIDDLE>，使整体代码最自然可用。");
  parts.push("");

  parts.push(`<FILE_PATH>`);
  parts.push(context.filePath);
  parts.push("</FILE_PATH>");
  parts.push("");

  parts.push(`<LANGUAGE>`);
  parts.push(context.language);
  parts.push("</LANGUAGE>");
  parts.push("");

  // 风格提示
  if (opts.includeStyleHints) {
    parts.push("<STYLE_HINTS>");
    parts.push(formatStyleHintsForPrompt(context.styleHints));
    parts.push("</STYLE_HINTS>");
    parts.push("");
  }

  // 诊断
  if (opts.includeDiagnostics && context.diagnostics.length > 0) {
    parts.push("<DIAGNOSTICS>");
    parts.push(formatDiagnosticsForPrompt(context.diagnostics));
    parts.push("</DIAGNOSTICS>");
    parts.push("");
  }

  // 符号
  if (opts.includeSymbols && context.symbols.length > 0) {
    parts.push("<SYMBOLS>");
    parts.push(formatSymbolsForPrompt(context.symbols, opts.maxSymbols));
    parts.push("</SYMBOLS>");
    parts.push("");
  }

  // 相关片段
  if (opts.includeRelatedSnippets && context.relatedSnippets.length > 0) {
    parts.push("<RELATED>");
    parts.push(formatRelatedSnippetsForPrompt(context.relatedSnippets));
    parts.push("</RELATED>");
    parts.push("");
  }

  // 代码结构
  parts.push("<PREFIX>");
  parts.push(context.prefix);
  parts.push("</PREFIX>");
  parts.push("");

  parts.push("<MIDDLE>");
  parts.push("</MIDDLE>");
  parts.push("");

  parts.push("<SUFFIX>");
  parts.push(context.suffix);
  parts.push("</SUFFIX>");
  parts.push("");

  parts.push("只输出 <MIDDLE> 的内容（纯文本），不要解释，不要 Markdown。");

  return parts.join("\n");
}

/**
 * 生成极简提示词（最小 token 消耗）
 */
export function generateMinimalPrompt(context: CompletionContext): string {
  return `${context.prefix}\n<CURSOR>\n${context.suffix}\n\n输出插入内容。`;
}

/**
 * 根据选项生成完整的 messages 数组
 */
export function generateCompletionMessages(
  context: CompletionContext,
  options: PromptGeneratorOptions = {},
): Array<{ role: "system" | "user"; content: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 选择 System Prompt（根据意图调整）
  let systemPrompt: string;
  if (opts.multiCandidate) {
    systemPrompt = COMPLETION_MULTI_CANDIDATE_SYSTEM_PROMPT;
  } else if (opts.useFIM) {
    systemPrompt = COMPLETION_FIM_SYSTEM_PROMPT;
  } else {
    // 使用意图增强的 System Prompt
    systemPrompt = getCompletionSystemPrompt(context.intent);
  }

  // 选择 User Prompt 格式
  const userPrompt = opts.useFIM
    ? generateFIMPrompt(context, opts)
    : generateUserPrompt(context, opts);

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];
}

// ============================================
// 后处理
// ============================================

/**
 * 清理模型输出
 */
export function cleanCompletionOutput(output: string): string {
  let cleaned = output;

  // 移除可能的 Markdown 代码块
  cleaned = cleaned.replace(/^```[\w]*\n?/, "");
  cleaned = cleaned.replace(/\n?```$/, "");

  // 移除 <CURSOR> 标记
  cleaned = cleaned.replace(/<CURSOR>/g, "");

  // 移除前导空行（但保留缩进）
  cleaned = cleaned.replace(/^\n+/, "");

  // 移除尾部多余空行
  cleaned = cleaned.replace(/\n{3,}$/, "\n\n");

  // 移除解释性文字（如果模型跑偏）
  const explanationPatterns = [
    /^Here's the completion:?\s*\n?/i,
    /^The completion is:?\s*\n?/i,
    /^Output:?\s*\n?/i,
    /^Result:?\s*\n?/i,
    /^I'll complete.*?\n/i,
  ];

  for (const pattern of explanationPatterns) {
    cleaned = cleaned.replace(pattern, "");
  }

  return cleaned;
}

/**
 * 解析多候选输出
 */
export function parseMultiCandidateOutput(output: string): Array<{ text: string; score: number }> {
  try {
    // 尝试解析 JSON
    const cleaned = output
      .replace(/^```json\n?/, "")
      .replace(/\n?```$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);

    if (parsed.candidates && Array.isArray(parsed.candidates)) {
      return (parsed.candidates as unknown[])
        .filter(
          (c): c is { text: string; score?: number } =>
            typeof c === "object" &&
            c !== null &&
            typeof (c as Record<string, unknown>).text === "string",
        )
        .map((c) => ({
          text: cleanCompletionOutput(c.text),
          score: typeof c.score === "number" ? c.score : 0.5,
        }))
        .sort((a, b) => b.score - a.score);
    }
  } catch {
    // JSON 解析失败，返回单个候选
  }

  return [{ text: cleanCompletionOutput(output), score: 1.0 }];
}

/**
 * 验证补全是否与 suffix 重复
 */
export function hasOverlapWithSuffix(completion: string, suffix: string): boolean {
  if (!completion || !suffix) return false;

  const completionLines = completion.trim().split("\n");
  const suffixLines = suffix.trim().split("\n");

  // 检查补全的最后几行是否与 suffix 的开头重叠
  for (let i = 1; i <= Math.min(3, completionLines.length); i++) {
    const completionEnd = completionLines.slice(-i).join("\n").trim();
    const suffixStart = suffixLines.slice(0, i).join("\n").trim();

    if (completionEnd === suffixStart && completionEnd.length > 10) {
      return true;
    }
  }

  return false;
}

/**
 * 截断过长的补全
 */
export function truncateCompletion(
  completion: string,
  maxLines: number = 20,
  maxChars: number = 2000,
): string {
  let result = completion;

  // 行数限制
  const lines = result.split("\n");
  if (lines.length > maxLines) {
    result = lines.slice(0, maxLines).join("\n");
  }

  // 字符数限制
  if (result.length > maxChars) {
    result = result.substring(0, maxChars);
    // 尝试在最后一个完整行截断
    const lastNewline = result.lastIndexOf("\n");
    if (lastNewline > maxChars * 0.8) {
      result = result.substring(0, lastNewline);
    }
  }

  return result;
}

// ============================================
// 导出
// ============================================

export {
  COMPLETION_SYSTEM_PROMPT as SYSTEM_PROMPT,
  COMPLETION_MULTI_CANDIDATE_SYSTEM_PROMPT as MULTI_CANDIDATE_SYSTEM_PROMPT,
  COMPLETION_FIM_SYSTEM_PROMPT as FIM_SYSTEM_PROMPT,
};
