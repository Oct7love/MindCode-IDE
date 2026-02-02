/**
 * Cursor-like Inline Completion 配置
 * 
 * 模型参数 + 停止序列 + 超时策略
 */

// ============================================
// 模型参数配置
// ============================================

export interface CompletionModelConfig {
  temperature: number;
  top_p: number;
  max_tokens: number;
  stop: string[];
  frequency_penalty?: number;
  presence_penalty?: number;
}

/**
 * Claude 系列配置
 * 
 * 特点：指令遵循强，适合复杂上下文
 * 推荐：claude-3-5-sonnet (平衡) / claude-3-haiku (快速)
 */
export const CLAUDE_COMPLETION_CONFIG: CompletionModelConfig = {
  temperature: 0.0,        // 代码补全需要确定性，0 最稳
  top_p: 0.95,             // 略微放开以允许多候选
  max_tokens: 256,         // 单次补全最多 ~20行，256 token 足够
  stop: [
    '\n\n\n',              // 连续三个空行 = 过度生成
    '```',                 // 开始输出 Markdown = 跑偏
    '###',                 // 开始解释
    '// ---',              // 分隔符
    '"""',                 // Python docstring 结束
    "'''",
  ],
  // Claude 不需要 frequency/presence penalty
};

/**
 * DeepSeek Coder 配置
 * 
 * 特点：代码专精，FIM 支持好，速度快
 * 推荐：deepseek-coder-33b-instruct / deepseek-coder-6.7b
 */
export const DEEPSEEK_COMPLETION_CONFIG: CompletionModelConfig = {
  temperature: 0.0,        // 同样 0 最稳
  top_p: 0.95,
  max_tokens: 256,
  stop: [
    '<|fim_end|>',         // DeepSeek FIM 专用 token
    '<|endoftext|>',
    '\n\n\n',
    '```',
    '###',
  ],
  frequency_penalty: 0.1,  // 轻微降低重复
  presence_penalty: 0.0,
};

/**
 * OpenAI GPT-4 / GPT-3.5 配置
 */
export const OPENAI_COMPLETION_CONFIG: CompletionModelConfig = {
  temperature: 0.0,
  top_p: 0.95,
  max_tokens: 256,
  stop: [
    '\n\n\n',
    '```',
    '###',
  ],
  frequency_penalty: 0.1,
  presence_penalty: 0.0,
};

/**
 * GLM-4 配置
 */
export const GLM_COMPLETION_CONFIG: CompletionModelConfig = {
  temperature: 0.1,        // GLM 需要略微 temperature 才稳定
  top_p: 0.9,
  max_tokens: 256,
  stop: [
    '\n\n\n',
    '```',
    '###',
  ],
};

// ============================================
// 补全请求配置
// ============================================

export interface CompletionRequestConfig {
  /** 防抖延迟 (ms) */
  debounceMs: number;
  /** 请求超时 (ms) */
  timeoutMs: number;
  /** 最大前缀行数 */
  maxPrefixLines: number;
  /** 最大后缀行数 */
  maxSuffixLines: number;
  /** 最大相关片段数 */
  maxRelatedSnippets: number;
  /** 最大符号数 */
  maxSymbols: number;
  /** 是否启用 FIM 模式 */
  useFIM: boolean;
  /** 是否启用多候选 */
  multiCandidate: boolean;
  /** 候选数量 */
  candidateCount: number;
}

export const DEFAULT_COMPLETION_REQUEST_CONFIG: CompletionRequestConfig = {
  debounceMs: 150,         // 150ms 防抖，平衡响应速度与请求频率
  timeoutMs: 3000,         // 3s 超时，超时则放弃本次补全
  maxPrefixLines: 100,     // 前缀最多 100 行 (~2000 tokens)
  maxSuffixLines: 50,      // 后缀最多 50 行 (~1000 tokens)
  maxRelatedSnippets: 3,   // 最多 3 个相关片段
  maxSymbols: 50,          // 最多 50 个符号
  useFIM: true,            // 优先使用 FIM 格式
  multiCandidate: false,   // 默认单候选
  candidateCount: 3,       // 多候选时返回 3 个
};

// ============================================
// 语言特定配置
// ============================================

export interface LanguageConfig {
  /** 缩进风格 */
  indentStyle: 'spaces' | 'tabs';
  /** 缩进大小 */
  indentSize: number;
  /** 是否使用分号 */
  semicolon: boolean;
  /** 字符串引号 */
  quotes: 'single' | 'double';
  /** 文件扩展名 */
  extensions: string[];
  /** 注释前缀 */
  commentPrefix: string;
  /** 块结束标记 (用于停止) */
  blockEndMarkers: string[];
}

export const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
  typescript: {
    indentStyle: 'spaces',
    indentSize: 2,
    semicolon: true,
    quotes: 'single',
    extensions: ['.ts', '.tsx'],
    commentPrefix: '//',
    blockEndMarkers: ['}', '];', '};'],
  },
  javascript: {
    indentStyle: 'spaces',
    indentSize: 2,
    semicolon: true,
    quotes: 'single',
    extensions: ['.js', '.jsx'],
    commentPrefix: '//',
    blockEndMarkers: ['}', '];', '};'],
  },
  python: {
    indentStyle: 'spaces',
    indentSize: 4,
    semicolon: false,
    quotes: 'double',
    extensions: ['.py'],
    commentPrefix: '#',
    blockEndMarkers: ['return', 'pass', 'raise', 'break', 'continue'],
  },
  go: {
    indentStyle: 'tabs',
    indentSize: 1,
    semicolon: false,
    quotes: 'double',
    extensions: ['.go'],
    commentPrefix: '//',
    blockEndMarkers: ['}', 'return'],
  },
  rust: {
    indentStyle: 'spaces',
    indentSize: 4,
    semicolon: true,
    quotes: 'double',
    extensions: ['.rs'],
    commentPrefix: '//',
    blockEndMarkers: ['}', '};', ');'],
  },
  cpp: {
    indentStyle: 'spaces',
    indentSize: 4,
    semicolon: true,
    quotes: 'double',
    extensions: ['.cpp', '.cc', '.cxx', '.h', '.hpp'],
    commentPrefix: '//',
    blockEndMarkers: ['}', '};', ');'],
  },
  c: {
    indentStyle: 'spaces',
    indentSize: 4,
    semicolon: true,
    quotes: 'double',
    extensions: ['.c', '.h'],
    commentPrefix: '//',
    blockEndMarkers: ['}', '};', ');'],
  },
  java: {
    indentStyle: 'spaces',
    indentSize: 4,
    semicolon: true,
    quotes: 'double',
    extensions: ['.java'],
    commentPrefix: '//',
    blockEndMarkers: ['}', '};'],
  },
};

// ============================================
// 工具函数
// ============================================

/**
 * 根据模型名称获取配置
 */
export function getModelConfig(modelName: string): CompletionModelConfig {
  const lowerName = modelName.toLowerCase();
  
  if (lowerName.includes('claude')) {
    return CLAUDE_COMPLETION_CONFIG;
  }
  if (lowerName.includes('deepseek')) {
    return DEEPSEEK_COMPLETION_CONFIG;
  }
  if (lowerName.includes('gpt') || lowerName.includes('openai')) {
    return OPENAI_COMPLETION_CONFIG;
  }
  if (lowerName.includes('glm')) {
    return GLM_COMPLETION_CONFIG;
  }
  
  // 默认使用 Claude 配置
  return CLAUDE_COMPLETION_CONFIG;
}

/**
 * 根据文件扩展名获取语言配置
 */
export function getLanguageConfig(filePath: string): LanguageConfig | null {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  
  for (const [lang, config] of Object.entries(LANGUAGE_CONFIGS)) {
    if (config.extensions.includes(ext)) {
      return config;
    }
  }
  
  return null;
}

/**
 * 检测语言
 */
export function detectLanguage(filePath: string): string {
  const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
  
  const extToLang: Record<string, string> = {
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.rs': 'rust',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c': 'c',
    '.h': 'c',
    '.hpp': 'cpp',
    '.java': 'java',
    '.rb': 'ruby',
    '.php': 'php',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.cs': 'csharp',
    '.vue': 'vue',
    '.svelte': 'svelte',
  };
  
  return extToLang[ext] || 'text';
}
