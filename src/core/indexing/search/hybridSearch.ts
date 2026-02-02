/**
 * 混合搜索服务
 * 结合符号搜索和语义搜索
 */

import type {
  SearchQuery,
  SearchResults,
  SearchResult,
  CodeSymbol,
  CodeChunk,
  SymbolKind,
} from '../types';
import { IndexStore } from '../storage/sqliteStore';

/** 搜索配置 */
export interface SearchConfig {
  /** 默认结果数量 */
  defaultLimit: number;
  /** 符号搜索权重 */
  symbolWeight: number;
  /** 语义搜索权重 */
  semanticWeight: number;
  /** 最小相关性得分 */
  minScore: number;
  /** 是否启用模糊匹配 */
  fuzzyMatch: boolean;
}

const DEFAULT_CONFIG: SearchConfig = {
  defaultLimit: 20,
  symbolWeight: 0.6,
  semanticWeight: 0.4,
  minScore: 0.1,
  fuzzyMatch: true,
};

/** 混合搜索服务 */
export class HybridSearch {
  private store: IndexStore;
  private config: SearchConfig;
  
  constructor(store: IndexStore, config: Partial<SearchConfig> = {}) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }
  
  /**
   * 执行搜索
   */
  async search(query: SearchQuery): Promise<SearchResults> {
    const startTime = Date.now();
    const limit = query.limit || this.config.defaultLimit;
    
    let results: SearchResult[] = [];
    
    switch (query.type) {
      case 'symbol':
        results = await this.symbolSearch(query, limit * 2);
        break;
      case 'semantic':
        results = await this.semanticSearch(query, limit * 2);
        break;
      case 'hybrid':
      default:
        results = await this.hybridSearch(query, limit * 2);
        break;
    }
    
    // 应用过滤器
    results = this.applyFilters(results, query);
    
    // 排序和限制
    results = results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
    
    const timeTaken = Date.now() - startTime;
    
    return {
      items: results,
      totalCount: results.length,
      timeTaken,
      hasMore: results.length >= limit,
    };
  }
  
  /**
   * 符号搜索
   */
  private async symbolSearch(query: SearchQuery, limit: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const queryLower = query.query.toLowerCase();
    const queryParts = queryLower.split(/[\s.]+/);
    
    // 搜索符号
    const symbols = this.store.searchSymbolsByName(query.query, limit);
    
    for (const symbol of symbols) {
      const score = this.calculateSymbolScore(symbol, queryLower, queryParts);
      
      if (score >= this.config.minScore) {
        results.push({
          item: symbol,
          score,
          matchType: symbol.name.toLowerCase() === queryLower ? 'exact' : 'fuzzy',
          highlights: this.getHighlights(symbol.name, query.query),
          context: this.getSymbolContext(symbol),
        });
      }
    }
    
    return results;
  }
  
  /**
   * 语义搜索（基于向量相似度）
   */
  private async semanticSearch(query: SearchQuery, limit: number): Promise<SearchResult[]> {
    // TODO: 实现向量搜索
    // 当前版本使用简单的文本匹配作为占位
    
    const results: SearchResult[] = [];
    const queryLower = query.query.toLowerCase();
    
    // 获取所有文件的代码片段
    const fileIndexes = this.store.getAllFileIndexes();
    
    for (const fileIndex of fileIndexes.slice(0, 20)) {
      const chunks = this.store.getCodeChunksInFile(fileIndex.filePath);
      
      for (const chunk of chunks) {
        const score = this.calculateTextScore(chunk.text, queryLower);
        
        if (score >= this.config.minScore) {
          results.push({
            item: chunk,
            score,
            matchType: 'semantic',
            highlights: [],
            context: chunk.text.slice(0, 200),
          });
        }
      }
    }
    
    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }
  
  /**
   * 混合搜索
   */
  private async hybridSearch(query: SearchQuery, limit: number): Promise<SearchResult[]> {
    // 并行执行两种搜索
    const [symbolResults, semanticResults] = await Promise.all([
      this.symbolSearch(query, limit),
      this.semanticSearch(query, limit),
    ]);
    
    // 合并结果
    const resultMap = new Map<string, SearchResult>();
    
    // 添加符号搜索结果
    for (const result of symbolResults) {
      const key = this.getResultKey(result);
      const adjustedScore = result.score * this.config.symbolWeight;
      
      if (!resultMap.has(key) || resultMap.get(key)!.score < adjustedScore) {
        resultMap.set(key, { ...result, score: adjustedScore });
      }
    }
    
    // 添加语义搜索结果
    for (const result of semanticResults) {
      const key = this.getResultKey(result);
      const adjustedScore = result.score * this.config.semanticWeight;
      
      if (resultMap.has(key)) {
        // 合并得分
        const existing = resultMap.get(key)!;
        resultMap.set(key, {
          ...existing,
          score: existing.score + adjustedScore,
          matchType: 'fuzzy',
        });
      } else {
        resultMap.set(key, { ...result, score: adjustedScore });
      }
    }
    
    return Array.from(resultMap.values());
  }
  
  /**
   * 应用过滤器
   */
  private applyFilters(results: SearchResult[], query: SearchQuery): SearchResult[] {
    return results.filter(result => {
      // 文件过滤
      if (query.fileFilter && query.fileFilter.length > 0) {
        const filePath = this.getFilePath(result.item);
        if (!query.fileFilter.some(f => filePath.includes(f))) {
          return false;
        }
      }
      
      // 符号类型过滤
      if (query.kindFilter && query.kindFilter.length > 0) {
        if ('kind' in result.item) {
          if (!query.kindFilter.includes(result.item.kind as SymbolKind)) {
            return false;
          }
        }
      }
      
      // 语言过滤
      if (query.languageFilter && query.languageFilter.length > 0) {
        const filePath = this.getFilePath(result.item);
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const langMap: Record<string, string> = {
          'ts': 'typescript', 'tsx': 'typescript',
          'js': 'javascript', 'jsx': 'javascript',
          'py': 'python', 'go': 'go', 'rs': 'rust',
        };
        const lang = langMap[ext] || ext;
        
        if (!query.languageFilter.includes(lang)) {
          return false;
        }
      }
      
      return true;
    });
  }
  
  /**
   * 计算符号匹配得分
   */
  private calculateSymbolScore(
    symbol: CodeSymbol,
    queryLower: string,
    queryParts: string[]
  ): number {
    const nameLower = symbol.name.toLowerCase();
    let score = 0;
    
    // 精确匹配
    if (nameLower === queryLower) {
      score = 1.0;
    }
    // 前缀匹配
    else if (nameLower.startsWith(queryLower)) {
      score = 0.9;
    }
    // 包含匹配
    else if (nameLower.includes(queryLower)) {
      score = 0.7;
    }
    // 驼峰/下划线匹配
    else if (this.matchCamelCase(nameLower, queryParts)) {
      score = 0.6;
    }
    // 模糊匹配
    else if (this.config.fuzzyMatch) {
      score = this.fuzzyScore(nameLower, queryLower);
    }
    
    // 根据符号类型加权
    const kindWeight: Record<string, number> = {
      'class': 1.1,
      'interface': 1.1,
      'function': 1.05,
      'method': 1.0,
      'type': 0.95,
      'variable': 0.9,
      'constant': 0.9,
      'property': 0.85,
    };
    
    score *= kindWeight[symbol.kind] || 1.0;
    
    // 如果有文档，稍微加分
    if (symbol.documentation) {
      score *= 1.05;
    }
    
    return Math.min(score, 1.0);
  }
  
  /**
   * 计算文本匹配得分
   */
  private calculateTextScore(text: string, queryLower: string): number {
    const textLower = text.toLowerCase();
    
    if (textLower.includes(queryLower)) {
      // 根据出现次数和位置计算得分
      const count = (textLower.match(new RegExp(queryLower, 'g')) || []).length;
      const firstPos = textLower.indexOf(queryLower);
      
      // 出现越早、次数越多，得分越高
      const posScore = 1 - (firstPos / textLower.length);
      const countScore = Math.min(count / 3, 1);
      
      return 0.3 + (posScore * 0.3) + (countScore * 0.2);
    }
    
    // 检查是否包含所有查询词
    const queryWords = queryLower.split(/\s+/);
    const matchedWords = queryWords.filter(w => textLower.includes(w));
    
    if (matchedWords.length === queryWords.length) {
      return 0.4;
    } else if (matchedWords.length > 0) {
      return 0.2 * (matchedWords.length / queryWords.length);
    }
    
    return 0;
  }
  
  /**
   * 驼峰匹配
   */
  private matchCamelCase(name: string, queryParts: string[]): boolean {
    // 将驼峰命名分割成单词
    const nameParts = name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .toLowerCase()
      .split(/\s+/);
    
    // 检查查询的每个部分是否都匹配
    return queryParts.every(part => 
      nameParts.some(np => np.startsWith(part) || np.includes(part))
    );
  }
  
  /**
   * 模糊匹配得分
   */
  private fuzzyScore(str: string, query: string): number {
    let queryIdx = 0;
    let matches = 0;
    
    for (let i = 0; i < str.length && queryIdx < query.length; i++) {
      if (str[i] === query[queryIdx]) {
        matches++;
        queryIdx++;
      }
    }
    
    if (queryIdx < query.length) {
      return 0; // 没有完全匹配所有查询字符
    }
    
    // 根据匹配的连续性和位置计算得分
    return (matches / Math.max(str.length, query.length)) * 0.5;
  }
  
  /**
   * 获取结果唯一键
   */
  private getResultKey(result: SearchResult): string {
    // CodeSymbol 和 CodeChunk 都有 id 属性
    return result.item.id;
  }
  
  /**
   * 获取文件路径
   */
  private getFilePath(item: CodeSymbol | CodeChunk): string {
    return item.filePath;
  }
  
  /**
   * 获取高亮片段
   */
  private getHighlights(text: string, query: string): string[] {
    const highlights: string[] = [];
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let idx = lowerText.indexOf(lowerQuery);
    while (idx !== -1) {
      highlights.push(text.substring(idx, idx + query.length));
      idx = lowerText.indexOf(lowerQuery, idx + 1);
    }
    
    return highlights;
  }
  
  /**
   * 获取符号上下文
   */
  private getSymbolContext(symbol: CodeSymbol): string {
    const parts: string[] = [];
    
    if (symbol.signature) {
      parts.push(symbol.signature);
    } else {
      parts.push(`${symbol.kind} ${symbol.name}`);
    }
    
    if (symbol.documentation) {
      parts.push(symbol.documentation.slice(0, 100));
    }
    
    return parts.join(' - ');
  }
  
  // ============ 特殊查询 ============
  
  /**
   * 查找符号定义
   */
  async findDefinition(symbolName: string): Promise<CodeSymbol | null> {
    const results = this.store.searchSymbolsByName(symbolName, 10);
    
    // 优先返回完全匹配的
    const exact = results.find(s => s.name === symbolName);
    return exact || results[0] || null;
  }
  
  /**
   * 查找引用（谁调用了这个符号）
   */
  async findReferences(symbolId: string): Promise<Array<{
    caller: CodeSymbol | null;
    line: number;
    expression: string;
  }>> {
    const callers = this.store.getCallers(symbolId);
    
    return callers.map(call => ({
      caller: this.store.getSymbol(call.callerId),
      line: call.callLine,
      expression: call.callExpression || '',
    }));
  }
  
  /**
   * 获取文件大纲（符号树）
   */
  async getFileOutline(filePath: string): Promise<CodeSymbol[]> {
    return this.store.getSymbolsInFile(filePath);
  }
  
  /**
   * 获取相关代码（用于 @codebase）
   */
  async getRelatedCode(query: string, limit = 10): Promise<Array<{
    filePath: string;
    code: string;
    relevance: number;
  }>> {
    const results = await this.search({
      query,
      type: 'hybrid',
      limit,
    });
    
    return results.items.map(result => {
      const item = result.item;
      return {
        filePath: item.filePath,
        code: 'text' in item ? item.text : (item.signature || item.name),
        relevance: result.score,
      };
    });
  }
}

/** 创建搜索服务 */
export function createHybridSearch(
  store: IndexStore,
  config?: Partial<SearchConfig>
): HybridSearch {
  return new HybridSearch(store, config);
}
