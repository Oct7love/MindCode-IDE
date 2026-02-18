/**
 * 智能模型路由 - 根据任务类型自动选择最优模型
 *
 * 策略：
 * - 简单查询 → Haiku（低成本）
 * - 工具调用判断 → Haiku（第一轮判断）
 * - 复杂推理 → 主模型（Opus/Sonnet）
 */

// 模型层级定义
export type ModelTier = "primary" | "fast" | "cache";

// 模型族定义（每个提供商的模型组）
export interface ModelFamily {
  primary: string; // 主力模型（最强）
  fast: string; // 快速模型（平衡）
  cache: string; // 缓存/轻量模型（最便宜）
}

// 预定义的模型族
export const MODEL_FAMILIES: Record<string, ModelFamily> = {
  // Claude 系列 (智能路由：简单任务自动调用 Haiku)
  "claude-opus-4-6": {
    primary: "claude-opus-4-6",
    fast: "claude-sonnet-4-5-20250929",
    cache: "claude-haiku-4-5-20251001",
  },
  "claude-sonnet-4-5-20250929": {
    primary: "claude-sonnet-4-5-20250929",
    fast: "claude-sonnet-4-5-20250929",
    cache: "claude-haiku-4-5-20251001",
  },
  "claude-haiku-4-5-20251001": {
    primary: "claude-haiku-4-5-20251001",
    fast: "claude-haiku-4-5-20251001",
    cache: "claude-haiku-4-5-20251001",
  },
  // Codesuc 特价渠道
  "codesuc-opus": {
    primary: "codesuc-opus",
    fast: "codesuc-sonnet",
    cache: "codesuc-haiku",
  },
  "codesuc-sonnet": {
    primary: "codesuc-sonnet",
    fast: "codesuc-sonnet",
    cache: "codesuc-haiku",
  },
  "codesuc-haiku": {
    primary: "codesuc-haiku",
    fast: "codesuc-haiku",
    cache: "codesuc-haiku",
  },
  // DeepSeek 系列
  "deepseek-chat": {
    primary: "deepseek-chat",
    fast: "deepseek-chat",
    cache: "deepseek-chat", // DeepSeek 本身就便宜
  },
  "deepseek-reasoner": {
    primary: "deepseek-reasoner",
    fast: "deepseek-chat",
    cache: "deepseek-chat",
  },
  // GLM 系列
  "glm-4.7": {
    primary: "glm-4.7",
    fast: "glm-4.7-flashx",
    cache: "glm-4.7-flashx",
  },
  "glm-4.7-flashx": {
    primary: "glm-4.7-flashx",
    fast: "glm-4.7-flashx",
    cache: "glm-4.7-flashx",
  },
  // Gemini 系列
  "gemini-3-pro-high": {
    primary: "gemini-3-pro-high",
    fast: "gemini-3-flash",
    cache: "gemini-3-flash",
  },
  "gemini-3-flash": {
    primary: "gemini-3-flash",
    fast: "gemini-3-flash",
    cache: "gemini-3-flash",
  },
  "gemini-2.5-flash": {
    primary: "gemini-2.5-flash",
    fast: "gemini-2.5-flash",
    cache: "gemini-2.5-flash",
  },
};

// 任务类型
export type TaskType =
  | "identity" // 身份问题
  | "greeting" // 简单问候
  | "tool_decision" // 工具调用判断
  | "simple_query" // 简单查询
  | "code_analysis" // 代码分析
  | "code_generation" // 代码生成
  | "complex_reasoning" // 复杂推理
  | "summarization"; // 总结

// 任务类型到模型层级的映射
const TASK_TO_TIER: Record<TaskType, ModelTier> = {
  identity: "cache",
  greeting: "cache",
  tool_decision: "cache",
  simple_query: "cache",
  code_analysis: "primary",
  code_generation: "primary",
  complex_reasoning: "primary",
  summarization: "fast",
};

/**
 * 获取模型族
 */
export function getModelFamily(modelId: string): ModelFamily {
  return (
    MODEL_FAMILIES[modelId] || {
      primary: modelId,
      fast: modelId,
      cache: modelId,
    }
  );
}

/**
 * 根据任务类型获取推荐模型
 */
export function getModelForTask(primaryModel: string, taskType: TaskType): string {
  const family = getModelFamily(primaryModel);
  const tier = TASK_TO_TIER[taskType];
  return family[tier];
}

/**
 * 复杂任务关键词 - 这些任务需要用主模型
 */
const COMPLEX_TASK_PATTERNS = [
  // 项目级操作
  /阅读.*项目|读.*项目|浏览.*项目|查看.*项目|了解.*项目/,
  /整个项目|全部代码|所有文件|项目结构/,
  /review|audit|检查|审查|评估/,
  // 代码分析
  /分析|解释|为什么|怎么.*工作|什么意思|analyze|explain|why|how.*work/,
  /不足|问题|改进|优化|重构|refactor|improve/,
  /调试|debug|排查|定位|找.*bug|fix/,
  // 代码生成
  /写一个|实现一个|创建一个|生成.*代码|帮我写|write.*code|implement|create.*function/,
  /添加|修改|更新|删除|移除|add|modify|update|delete|remove/,
  // 架构设计
  /设计|架构|方案|计划|plan|design|architecture/,
];

/**
 * 检测任务类型
 */
export function detectTaskType(
  userMessage: string,
  _hasToolCalls: boolean = false,
  _isFirstRound: boolean = true,
  _messageCount: number = 0,
  useTools: boolean = false,
): TaskType {
  const msg = userMessage.toLowerCase().trim();

  // 身份问题 - 可以用 Haiku
  if (/你是什么模型|你是谁|what model|who are you|你叫什么/.test(msg)) {
    return "identity";
  }

  // 简单问候 - 可以用 Haiku
  if (/^(你好|hi|hello|hey|嗨|早上好|晚上好|下午好)[!！。.？?]*$/i.test(msg)) {
    return "greeting";
  }

  // 检查复杂任务关键词 - 必须用主模型
  for (const pattern of COMPLEX_TASK_PATTERNS) {
    if (pattern.test(msg)) {
      // 匹配到复杂任务关键词
      if (
        /写一个|实现一个|创建一个|生成.*代码|帮我写|write.*code|implement|create.*function|添加|修改/.test(
          msg,
        )
      ) {
        return "code_generation";
      }
      if (/分析|解释|阅读|review|检查|审查/.test(msg)) {
        return "code_analysis";
      }
      return "complex_reasoning";
    }
  }

  // 如果会使用工具，说明是复杂任务 - 必须用主模型
  if (useTools) {
    return "complex_reasoning";
  }

  // 短消息（<20字符）且没有任何技术关键词 → 简单查询
  if (msg.length < 20 && !/代码|函数|bug|error|错误|实现|优化|重构|分析|项目|文件/.test(msg)) {
    return "simple_query";
  }

  // 总结任务 - 可以用 fast 模型
  if (/^(总结|概括|summarize|summary)/.test(msg) && msg.length < 50) {
    return "summarization";
  }

  // 默认：复杂推理（保守策略，用主模型）
  return "complex_reasoning";
}

/**
 * 智能模型路由器
 */
export class ModelRouter {
  private primaryModel: string;
  private enabled: boolean = true;

  constructor(primaryModel: string) {
    this.primaryModel = primaryModel;
  }

  /**
   * 启用/禁用智能路由
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * 更新主模型
   */
  setPrimaryModel(model: string): void {
    this.primaryModel = model;
  }

  /**
   * 获取推荐模型
   */
  route(
    userMessage: string,
    options: {
      hasToolCalls?: boolean;
      isFirstRound?: boolean;
      messageCount?: number;
      forceUsePrimary?: boolean;
      useTools?: boolean; // 是否会使用工具
    } = {},
  ): { model: string; taskType: TaskType; reason: string } {
    if (!this.enabled || options.forceUsePrimary) {
      return {
        model: this.primaryModel,
        taskType: "complex_reasoning",
        reason: "forced_primary",
      };
    }

    const taskType = detectTaskType(
      userMessage,
      options.hasToolCalls || false,
      options.isFirstRound !== false,
      options.messageCount || 0,
      options.useTools || false,
    );

    const model = getModelForTask(this.primaryModel, taskType);
    const reason =
      model === this.primaryModel ? "using_primary" : `routed_to_${TASK_TO_TIER[taskType]}`;

    return { model, taskType, reason };
  }

  /**
   * 获取缓存模型（用于预检查等）
   */
  getCacheModel(): string {
    return getModelFamily(this.primaryModel).cache;
  }

  /**
   * 获取快速模型
   */
  getFastModel(): string {
    return getModelFamily(this.primaryModel).fast;
  }
}

// 默认路由器实例
let defaultRouter: ModelRouter | null = null;

export function getModelRouter(primaryModel?: string): ModelRouter {
  if (!defaultRouter || (primaryModel && defaultRouter["primaryModel"] !== primaryModel)) {
    defaultRouter = new ModelRouter(primaryModel || "claude-opus-4-6");
  }
  return defaultRouter;
}
