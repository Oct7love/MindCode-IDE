/**
 * 代码索引核心类型定义
 * MindCode Indexing System
 */

// ============ 符号类型 ============

/** 符号类型枚举 */
export type SymbolKind = 
  | 'function' 
  | 'class' 
  | 'interface' 
  | 'type' 
  | 'variable' 
  | 'constant'
  | 'enum'
  | 'method'
  | 'property'
  | 'parameter'
  | 'import'
  | 'export'
  | 'namespace'
  | 'module';

/** 代码符号 */
export interface CodeSymbol {
  /** 唯一 ID */
  id: string;
  /** 符号名称 */
  name: string;
  /** 符号类型 */
  kind: SymbolKind;
  /** 所在文件路径 */
  filePath: string;
  /** 起始行（1-based） */
  startLine: number;
  /** 结束行（1-based） */
  endLine: number;
  /** 起始列 */
  startColumn: number;
  /** 结束列 */
  endColumn: number;
  /** 函数/方法签名 */
  signature?: string;
  /** 文档注释 */
  documentation?: string;
  /** 父符号 ID */
  parentId?: string;
  /** 修饰符 */
  modifiers?: string[];
  /** 泛型参数 */
  typeParameters?: string[];
  /** 返回类型 */
  returnType?: string;
  /** 参数列表 */
  parameters?: ParameterInfo[];
  /** 导入来源 */
  importSource?: string;
  /** 导出类型 */
  exportType?: 'named' | 'default' | 're-export';
}

/** 参数信息 */
export interface ParameterInfo {
  name: string;
  type?: string;
  optional?: boolean;
  defaultValue?: string;
}

// ============ 调用关系 ============

/** 调用类型 */
export type CallType = 'direct' | 'indirect' | 'dynamic' | 'constructor';

/** 调用关系 */
export interface CallRelation {
  /** 调用者符号 ID */
  callerId: string;
  /** 被调用者符号 ID */
  calleeId: string;
  /** 调用所在行 */
  callLine: number;
  /** 调用类型 */
  callType: CallType;
  /** 调用表达式 */
  callExpression?: string;
}

// ============ 文件索引 ============

/** 文件索引状态 */
export type IndexStatus = 'pending' | 'indexing' | 'indexed' | 'error';

/** 文件索引信息 */
export interface FileIndex {
  /** 文件路径 */
  filePath: string;
  /** 内容哈希（用于检测变更） */
  contentHash: string;
  /** 索引时间 */
  indexedAt: number;
  /** 符号数量 */
  symbolCount: number;
  /** 索引状态 */
  status: IndexStatus;
  /** 错误信息 */
  error?: string;
  /** 文件语言 */
  language: string;
  /** 文件大小（字节） */
  fileSize: number;
}

// ============ 向量嵌入 ============

/** 代码片段 */
export interface CodeChunk {
  /** 唯一 ID */
  id: string;
  /** 关联的符号 ID */
  symbolId?: string;
  /** 文件路径 */
  filePath: string;
  /** 起始行 */
  startLine: number;
  /** 结束行 */
  endLine: number;
  /** 代码文本 */
  text: string;
  /** 嵌入向量（可选，存储时生成） */
  embedding?: number[];
  /** 嵌入模型 */
  embeddingModel?: string;
}

// ============ 搜索相关 ============

/** 搜索类型 */
export type SearchType = 'symbol' | 'semantic' | 'hybrid';

/** 搜索查询 */
export interface SearchQuery {
  /** 查询文本 */
  query: string;
  /** 搜索类型 */
  type: SearchType;
  /** 限制结果数量 */
  limit?: number;
  /** 文件过滤 */
  fileFilter?: string[];
  /** 符号类型过滤 */
  kindFilter?: SymbolKind[];
  /** 语言过滤 */
  languageFilter?: string[];
}

/** 搜索结果项 */
export interface SearchResult {
  /** 匹配的符号或代码片段 */
  item: CodeSymbol | CodeChunk;
  /** 相关性得分 (0-1) */
  score: number;
  /** 匹配类型 */
  matchType: 'exact' | 'fuzzy' | 'semantic';
  /** 高亮片段 */
  highlights?: string[];
  /** 上下文代码 */
  context?: string;
}

/** 搜索结果 */
export interface SearchResults {
  /** 结果列表 */
  items: SearchResult[];
  /** 总匹配数 */
  totalCount: number;
  /** 搜索耗时（毫秒） */
  timeTaken: number;
  /** 是否有更多结果 */
  hasMore: boolean;
}

// ============ 依赖关系 ============

/** 依赖类型 */
export type DependencyType = 'import' | 'require' | 'dynamic';

/** 文件依赖 */
export interface FileDependency {
  /** 源文件 */
  sourceFile: string;
  /** 目标文件 */
  targetFile: string;
  /** 依赖类型 */
  type: DependencyType;
  /** 导入的符号 */
  importedSymbols?: string[];
  /** 是否是类型导入 */
  isTypeOnly?: boolean;
}

// ============ 索引进度 ============

/** 索引进度 */
export interface IndexProgress {
  /** 总文件数 */
  totalFiles: number;
  /** 已索引文件数 */
  indexedFiles: number;
  /** 当前正在索引的文件 */
  currentFile?: string;
  /** 索引状态 */
  status: 'idle' | 'scanning' | 'indexing' | 'complete' | 'error';
  /** 开始时间 */
  startTime?: number;
  /** 预计剩余时间（秒） */
  estimatedRemaining?: number;
  /** 错误列表 */
  errors?: Array<{ file: string; error: string }>;
}

// ============ 索引配置 ============

/** 索引配置 */
export interface IndexConfig {
  /** 包含的文件模式 */
  includePatterns: string[];
  /** 排除的文件模式 */
  excludePatterns: string[];
  /** 最大文件大小（字节） */
  maxFileSize: number;
  /** 是否启用向量索引 */
  enableEmbeddings: boolean;
  /** 嵌入模型 */
  embeddingModel: string;
  /** 是否增量索引 */
  incrementalIndex: boolean;
  /** 并发数 */
  concurrency: number;
  /** 支持的语言 */
  supportedLanguages: string[];
}

/** 默认索引配置 */
export const DEFAULT_INDEX_CONFIG: IndexConfig = {
  includePatterns: [
    '**/*.ts',
    '**/*.tsx',
    '**/*.js',
    '**/*.jsx',
    '**/*.py',
    '**/*.go',
    '**/*.rs',
    '**/*.java',
    '**/*.c',
    '**/*.cpp',
    '**/*.h',
    '**/*.hpp',
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.git/**',
    '**/coverage/**',
    '**/*.min.js',
    '**/*.bundle.js',
  ],
  maxFileSize: 1024 * 1024, // 1MB
  enableEmbeddings: true,
  embeddingModel: 'openai-text-embedding-3-small',
  incrementalIndex: true,
  concurrency: 4,
  supportedLanguages: ['typescript', 'javascript', 'python', 'go', 'rust', 'java', 'c', 'cpp'],
};
