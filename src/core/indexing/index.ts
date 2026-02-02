/**
 * 代码索引模块入口
 * MindCode Indexing System
 */

// 类型导出
export * from './types';

// 解析器
export { TypeScriptParser, createTypeScriptParser, type ParseResult } from './parser/typescript';

// 符号提取器
export { SymbolExtractor, createSymbolExtractor, type ExtractorConfig } from './extractor/symbolExtractor';

// 存储
export { IndexStore, createIndexStore, type StoreConfig } from './storage/sqliteStore';

// 搜索
export { HybridSearch, createHybridSearch, type SearchConfig } from './search/hybridSearch';

// 索引服务
export { 
  IndexService, 
  createIndexService, 
  getIndexService,
  type IndexServiceEvents 
} from './indexService';
