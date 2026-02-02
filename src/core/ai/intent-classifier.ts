/**
 * 意图分类器 - Intent Classifier
 * 
 * 识别用户在编辑器中的意图：
 * - generate: 生成新代码
 * - complete: 补全当前代码
 * - fix: 修复错误
 * - refactor: 重构代码
 * - explain: 解释代码
 * - test: 生成测试
 * - document: 生成文档/注释
 */

// ============================================
// 类型定义
// ============================================

export type IntentType = 
  | 'generate'    // 生成新代码/函数
  | 'complete'    // 补全当前语句
  | 'fix'         // 修复错误/bug
  | 'refactor'    // 重构/优化
  | 'explain'     // 解释代码
  | 'test'        // 生成测试
  | 'document'    // 生成文档
  | 'unknown';    // 未知意图

export interface IntentResult {
  type: IntentType;
  confidence: number;      // 0-1 置信度
  description: string;     // 中文描述
  keywords: string[];      // 匹配到的关键词
  suggestedAction?: string; // 建议的操作
}

// ============================================
// 关键词映射
// ============================================

interface IntentPattern {
  type: IntentType;
  keywords: RegExp[];
  priority: number;
}

const INTENT_PATTERNS: IntentPattern[] = [
  // 生成意图 - 最常见
  {
    type: 'generate',
    keywords: [
      /实现|写一个|创建|生成|添加|新增|编写/,
      /implement|create|write|add|make|build|generate/i,
      /function|class|method|component|module|api|handler/i,
      /函数|类|方法|组件|模块|接口|处理器/,
    ],
    priority: 10,
  },
  
  // 修复意图
  {
    type: 'fix',
    keywords: [
      /修复|修正|解决|fix|bug|error|issue|problem/i,
      /错误|问题|异常|崩溃|失败/,
      /doesn't work|not working|broken|failed|crash/i,
      /todo.*fix|fixme|hack/i,
    ],
    priority: 20,
  },
  
  // 重构意图
  {
    type: 'refactor',
    keywords: [
      /重构|优化|改进|简化|提取|抽取/,
      /refactor|optimize|improve|simplify|extract|clean/i,
      /性能|performance|速度|效率/i,
      /更好|better|cleaner|faster/i,
    ],
    priority: 15,
  },
  
  // 测试意图
  {
    type: 'test',
    keywords: [
      /测试|单元测试|集成测试|test|unit test|spec/i,
      /assert|expect|should|describe|it\(/i,
      /mock|stub|spy|coverage/i,
    ],
    priority: 18,
  },
  
  // 文档意图
  {
    type: 'document',
    keywords: [
      /文档|注释|说明|描述|document|comment|doc|jsdoc/i,
      /readme|changelog|api doc/i,
      /\/\*\*|\*\s*@param|@return|@example/i,
    ],
    priority: 12,
  },
  
  // 解释意图
  {
    type: 'explain',
    keywords: [
      /解释|说明|是什么|怎么|为什么|explain|what|how|why/i,
      /这段代码|this code|这个函数|this function/i,
    ],
    priority: 8,
  },
  
  // 补全意图 - 默认
  {
    type: 'complete',
    keywords: [
      /补全|完成|继续|complete|continue|finish/i,
      /\.{3}|…|todo|待完成/i,
    ],
    priority: 5,
  },
];

// ============================================
// 意图描述
// ============================================

const INTENT_DESCRIPTIONS: Record<IntentType, string> = {
  generate: '生成新代码',
  complete: '补全代码',
  fix: '修复问题',
  refactor: '重构优化',
  explain: '解释代码',
  test: '生成测试',
  document: '生成文档',
  unknown: '未知意图',
};

const INTENT_ACTIONS: Record<IntentType, string> = {
  generate: '将生成完整的代码实现',
  complete: '将补全当前语句',
  fix: '将修复检测到的问题',
  refactor: '将优化代码结构',
  explain: '将添加解释性注释',
  test: '将生成测试用例',
  document: '将添加文档注释',
  unknown: '将根据上下文补全',
};

// ============================================
// 分类器实现
// ============================================

/**
 * 从注释或代码中分类用户意图
 */
export function classifyIntent(
  text: string,
  context?: {
    currentLine?: string;
    previousLines?: string[];
    diagnostics?: Array<{ message: string; severity: string }>;
    fileName?: string;
  }
): IntentResult {
  const normalizedText = text.toLowerCase();
  const matchedIntents: Array<{ type: IntentType; score: number; keywords: string[] }> = [];

  // 1. 从文本匹配关键词
  for (const pattern of INTENT_PATTERNS) {
    let score = 0;
    const matchedKeywords: string[] = [];

    for (const regex of pattern.keywords) {
      const match = normalizedText.match(regex);
      if (match) {
        score += pattern.priority;
        matchedKeywords.push(match[0]);
      }
    }

    if (score > 0) {
      matchedIntents.push({
        type: pattern.type,
        score,
        keywords: matchedKeywords,
      });
    }
  }

  // 2. 上下文增强
  if (context) {
    // 有诊断错误 → 可能是 fix
    if (context.diagnostics && context.diagnostics.length > 0) {
      const hasError = context.diagnostics.some(d => d.severity === 'error');
      if (hasError) {
        const existing = matchedIntents.find(i => i.type === 'fix');
        if (existing) {
          existing.score += 30;
        } else {
          matchedIntents.push({ type: 'fix', score: 25, keywords: ['diagnostic error'] });
        }
      }
    }

    // 文件名包含 test → 可能是 test
    if (context.fileName && /test|spec/i.test(context.fileName)) {
      const existing = matchedIntents.find(i => i.type === 'test');
      if (existing) {
        existing.score += 20;
      } else {
        matchedIntents.push({ type: 'test', score: 15, keywords: ['test file'] });
      }
    }

    // 当前行是空的或只有缩进 → complete
    if (context.currentLine && context.currentLine.trim() === '') {
      const existing = matchedIntents.find(i => i.type === 'complete');
      if (existing) {
        existing.score += 10;
      }
    }
  }

  // 3. 排序并选择最高分
  matchedIntents.sort((a, b) => b.score - a.score);

  if (matchedIntents.length === 0) {
    return {
      type: 'complete', // 默认是补全
      confidence: 0.5,
      description: INTENT_DESCRIPTIONS.complete,
      keywords: [],
      suggestedAction: INTENT_ACTIONS.complete,
    };
  }

  const best = matchedIntents[0];
  const maxPossibleScore = 100; // 归一化
  const confidence = Math.min(best.score / maxPossibleScore, 1);

  return {
    type: best.type,
    confidence,
    description: INTENT_DESCRIPTIONS[best.type],
    keywords: best.keywords,
    suggestedAction: INTENT_ACTIONS[best.type],
  };
}

/**
 * 从注释中提取意图
 */
export function extractIntentFromComment(comment: string): IntentResult {
  // 移除注释前缀
  const cleaned = comment
    .replace(/^\/\/\s*/, '')
    .replace(/^#\s*/, '')
    .replace(/^\/\*\s*/, '')
    .replace(/\s*\*\/$/, '')
    .replace(/^"""\s*/, '')
    .replace(/^'''\s*/, '')
    .trim();

  return classifyIntent(cleaned);
}

/**
 * 根据意图类型返回补全 prompt 修饰词
 */
export function getIntentPromptModifier(intent: IntentResult): string {
  switch (intent.type) {
    case 'generate':
      return `用户意图：生成新代码。请提供完整、可运行的实现，包含必要的类型定义和错误处理。`;
    
    case 'fix':
      return `用户意图：修复问题。请分析可能的错误并提供修复代码，保持最小改动原则。`;
    
    case 'refactor':
      return `用户意图：重构优化。请改进代码质量、可读性或性能，保持功能不变。`;
    
    case 'test':
      return `用户意图：生成测试。请提供覆盖主要场景的测试用例，使用项目已有的测试框架风格。`;
    
    case 'document':
      return `用户意图：生成文档。请添加清晰的文档注释，包含参数、返回值、示例等。`;
    
    case 'explain':
      return `用户意图：解释代码。请添加解释性注释，说明代码的作用和逻辑。`;
    
    case 'complete':
    default:
      return `用户意图：补全代码。请自然地补全当前语句或代码块。`;
  }
}

/**
 * 根据意图类型调整补全参数
 */
export function getIntentCompletionParams(intent: IntentResult): {
  maxLines: number;
  maxTokens: number;
  temperature: number;
} {
  switch (intent.type) {
    case 'generate':
      return { maxLines: 30, maxTokens: 512, temperature: 0.1 };
    
    case 'fix':
      return { maxLines: 15, maxTokens: 256, temperature: 0 };
    
    case 'refactor':
      return { maxLines: 40, maxTokens: 768, temperature: 0.1 };
    
    case 'test':
      return { maxLines: 50, maxTokens: 1024, temperature: 0.2 };
    
    case 'document':
      return { maxLines: 20, maxTokens: 384, temperature: 0.1 };
    
    case 'explain':
      return { maxLines: 10, maxTokens: 256, temperature: 0.1 };
    
    case 'complete':
    default:
      return { maxLines: 20, maxTokens: 256, temperature: 0 };
  }
}

// ============================================
// 导出
// ============================================

export {
  INTENT_DESCRIPTIONS,
  INTENT_ACTIONS,
};
