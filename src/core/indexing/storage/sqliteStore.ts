/**
 * SQLite 索引存储
 * 使用 sql.js（纯 JS 实现的 SQLite）
 */

import type {
  CodeSymbol,
  FileIndex,
  CallRelation,
  FileDependency,
  CodeChunk,
  SearchResults,
  SearchQuery,
  SearchResult,
} from '../types';

// sql.js 类型（运行时动态加载）
interface SqlJsDatabase {
  run(sql: string, params?: any[]): void;
  exec(sql: string): any[];
  prepare(sql: string): SqlJsStatement;
  close(): void;
  export(): Uint8Array;
}

interface SqlJsStatement {
  bind(params?: any[]): boolean;
  step(): boolean;
  get(): any[];
  getAsObject(): Record<string, any>;
  free(): void;
  run(params?: any[]): void;
}

interface SqlJs {
  Database: new (data?: ArrayLike<number>) => SqlJsDatabase;
}

/** 存储配置 */
export interface StoreConfig {
  /** 数据库文件路径 */
  dbPath?: string;
  /** 是否持久化 */
  persistent: boolean;
}

/** SQLite 索引存储 */
export class IndexStore {
  private db: SqlJsDatabase | null = null;
  private sqlJs: SqlJs | null = null;
  private config: StoreConfig;
  private initialized = false;
  
  constructor(config: Partial<StoreConfig> = {}) {
    this.config = {
      persistent: false,
      ...config,
    };
  }
  
  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    // 动态加载 sql.js
    const initSqlJs = require('sql.js');
    this.sqlJs = await initSqlJs({
      // 使用内置 WASM
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });
    
    // 创建数据库
    this.db = new this.sqlJs!.Database();
    
    // 创建表结构
    this.createTables();
    this.initialized = true;
    
    console.log('[IndexStore] 数据库初始化完成');
  }
  
  /**
   * 创建表结构
   */
  private createTables(): void {
    if (!this.db) throw new Error('Database not initialized');
    
    // 文件索引表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS file_index (
        file_path TEXT PRIMARY KEY,
        content_hash TEXT NOT NULL,
        indexed_at INTEGER NOT NULL,
        symbol_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        error TEXT,
        language TEXT,
        file_size INTEGER
      )
    `);
    
    // 符号表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS symbols (
        id TEXT PRIMARY KEY,
        file_path TEXT NOT NULL,
        name TEXT NOT NULL,
        kind TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        start_column INTEGER,
        end_column INTEGER,
        signature TEXT,
        documentation TEXT,
        parent_id TEXT,
        modifiers TEXT,
        type_parameters TEXT,
        return_type TEXT,
        parameters TEXT,
        import_source TEXT,
        export_type TEXT,
        FOREIGN KEY (file_path) REFERENCES file_index(file_path) ON DELETE CASCADE
      )
    `);
    
    // 调用关系表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS call_relations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        caller_id TEXT NOT NULL,
        callee_id TEXT NOT NULL,
        call_line INTEGER,
        call_type TEXT,
        call_expression TEXT,
        FOREIGN KEY (caller_id) REFERENCES symbols(id) ON DELETE CASCADE
      )
    `);
    
    // 文件依赖表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS file_dependencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_file TEXT NOT NULL,
        target_file TEXT NOT NULL,
        dep_type TEXT,
        imported_symbols TEXT,
        is_type_only INTEGER DEFAULT 0,
        FOREIGN KEY (source_file) REFERENCES file_index(file_path) ON DELETE CASCADE
      )
    `);
    
    // 代码片段表（用于向量搜索）
    this.db.run(`
      CREATE TABLE IF NOT EXISTS code_chunks (
        id TEXT PRIMARY KEY,
        symbol_id TEXT,
        file_path TEXT NOT NULL,
        start_line INTEGER,
        end_line INTEGER,
        text TEXT NOT NULL,
        embedding BLOB,
        embedding_model TEXT,
        FOREIGN KEY (file_path) REFERENCES file_index(file_path) ON DELETE CASCADE
      )
    `);
    
    // 创建索引
    this.db.run('CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_path)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_symbols_name ON symbols(name)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_symbols_kind ON symbols(kind)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_call_caller ON call_relations(caller_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_call_callee ON call_relations(callee_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_deps_source ON file_dependencies(source_file)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_deps_target ON file_dependencies(target_file)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_chunks_file ON code_chunks(file_path)');
  }
  
  // ============ 文件索引操作 ============
  
  /**
   * 保存文件索引信息
   */
  saveFileIndex(fileIndex: FileIndex): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(`
      INSERT OR REPLACE INTO file_index 
      (file_path, content_hash, indexed_at, symbol_count, status, error, language, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      fileIndex.filePath,
      fileIndex.contentHash,
      fileIndex.indexedAt,
      fileIndex.symbolCount,
      fileIndex.status,
      fileIndex.error || null,
      fileIndex.language,
      fileIndex.fileSize,
    ]);
  }
  
  /**
   * 获取文件索引信息
   */
  getFileIndex(filePath: string): FileIndex | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM file_index WHERE file_path = ?');
    stmt.bind([filePath]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return {
        filePath: row.file_path as string,
        contentHash: row.content_hash as string,
        indexedAt: row.indexed_at as number,
        symbolCount: row.symbol_count as number,
        status: row.status as FileIndex['status'],
        error: row.error as string | undefined,
        language: row.language as string,
        fileSize: row.file_size as number,
      };
    }
    
    stmt.free();
    return null;
  }
  
  /**
   * 删除文件索引（级联删除相关数据）
   */
  deleteFileIndex(filePath: string): void {
    if (!this.db) throw new Error('Database not initialized');
    
    // SQLite 不支持 CASCADE，手动删除
    this.db.run('DELETE FROM code_chunks WHERE file_path = ?', [filePath]);
    this.db.run('DELETE FROM call_relations WHERE caller_id IN (SELECT id FROM symbols WHERE file_path = ?)', [filePath]);
    this.db.run('DELETE FROM file_dependencies WHERE source_file = ?', [filePath]);
    this.db.run('DELETE FROM symbols WHERE file_path = ?', [filePath]);
    this.db.run('DELETE FROM file_index WHERE file_path = ?', [filePath]);
  }
  
  /**
   * 获取所有已索引的文件
   */
  getAllFileIndexes(): FileIndex[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: FileIndex[] = [];
    const stmt = this.db.prepare('SELECT * FROM file_index');
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        filePath: row.file_path as string,
        contentHash: row.content_hash as string,
        indexedAt: row.indexed_at as number,
        symbolCount: row.symbol_count as number,
        status: row.status as FileIndex['status'],
        error: row.error as string | undefined,
        language: row.language as string,
        fileSize: row.file_size as number,
      });
    }
    
    stmt.free();
    return results;
  }
  
  // ============ 符号操作 ============
  
  /**
   * 保存符号
   */
  saveSymbol(symbol: CodeSymbol): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(`
      INSERT OR REPLACE INTO symbols 
      (id, file_path, name, kind, start_line, end_line, start_column, end_column,
       signature, documentation, parent_id, modifiers, type_parameters, return_type,
       parameters, import_source, export_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      symbol.id,
      symbol.filePath,
      symbol.name,
      symbol.kind,
      symbol.startLine,
      symbol.endLine,
      symbol.startColumn,
      symbol.endColumn,
      symbol.signature || null,
      symbol.documentation || null,
      symbol.parentId || null,
      symbol.modifiers ? JSON.stringify(symbol.modifiers) : null,
      symbol.typeParameters ? JSON.stringify(symbol.typeParameters) : null,
      symbol.returnType || null,
      symbol.parameters ? JSON.stringify(symbol.parameters) : null,
      symbol.importSource || null,
      symbol.exportType || null,
    ]);
  }
  
  /**
   * 批量保存符号
   */
  saveSymbols(symbols: CodeSymbol[]): void {
    for (const symbol of symbols) {
      this.saveSymbol(symbol);
    }
  }
  
  /**
   * 获取符号
   */
  getSymbol(id: string): CodeSymbol | null {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM symbols WHERE id = ?');
    stmt.bind([id]);
    
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return this.rowToSymbol(row);
    }
    
    stmt.free();
    return null;
  }
  
  /**
   * 按名称搜索符号
   */
  searchSymbolsByName(name: string, limit = 50): CodeSymbol[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: CodeSymbol[] = [];
    const stmt = this.db.prepare(`
      SELECT * FROM symbols 
      WHERE name LIKE ? 
      ORDER BY 
        CASE WHEN name = ? THEN 0 ELSE 1 END,
        length(name)
      LIMIT ?
    `);
    stmt.bind([`%${name}%`, name, limit]);
    
    while (stmt.step()) {
      results.push(this.rowToSymbol(stmt.getAsObject()));
    }
    
    stmt.free();
    return results;
  }
  
  /**
   * 获取文件中的所有符号
   */
  getSymbolsInFile(filePath: string): CodeSymbol[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: CodeSymbol[] = [];
    const stmt = this.db.prepare('SELECT * FROM symbols WHERE file_path = ? ORDER BY start_line');
    stmt.bind([filePath]);
    
    while (stmt.step()) {
      results.push(this.rowToSymbol(stmt.getAsObject()));
    }
    
    stmt.free();
    return results;
  }
  
  /**
   * 按类型获取符号
   */
  getSymbolsByKind(kind: string, limit = 100): CodeSymbol[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: CodeSymbol[] = [];
    const stmt = this.db.prepare('SELECT * FROM symbols WHERE kind = ? LIMIT ?');
    stmt.bind([kind, limit]);
    
    while (stmt.step()) {
      results.push(this.rowToSymbol(stmt.getAsObject()));
    }
    
    stmt.free();
    return results;
  }
  
  /**
   * 行转符号
   */
  private rowToSymbol(row: Record<string, any>): CodeSymbol {
    return {
      id: row.id,
      filePath: row.file_path,
      name: row.name,
      kind: row.kind,
      startLine: row.start_line,
      endLine: row.end_line,
      startColumn: row.start_column,
      endColumn: row.end_column,
      signature: row.signature || undefined,
      documentation: row.documentation || undefined,
      parentId: row.parent_id || undefined,
      modifiers: row.modifiers ? JSON.parse(row.modifiers) : undefined,
      typeParameters: row.type_parameters ? JSON.parse(row.type_parameters) : undefined,
      returnType: row.return_type || undefined,
      parameters: row.parameters ? JSON.parse(row.parameters) : undefined,
      importSource: row.import_source || undefined,
      exportType: row.export_type || undefined,
    };
  }
  
  // ============ 调用关系操作 ============
  
  /**
   * 保存调用关系
   */
  saveCallRelation(relation: CallRelation): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(`
      INSERT INTO call_relations (caller_id, callee_id, call_line, call_type, call_expression)
      VALUES (?, ?, ?, ?, ?)
    `, [
      relation.callerId,
      relation.calleeId,
      relation.callLine,
      relation.callType,
      relation.callExpression || null,
    ]);
  }
  
  /**
   * 批量保存调用关系
   */
  saveCallRelations(relations: CallRelation[]): void {
    for (const relation of relations) {
      this.saveCallRelation(relation);
    }
  }
  
  /**
   * 获取调用者（谁调用了这个符号）
   */
  getCallers(symbolId: string): CallRelation[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: CallRelation[] = [];
    const stmt = this.db.prepare('SELECT * FROM call_relations WHERE callee_id = ?');
    stmt.bind([symbolId]);
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        callerId: row.caller_id as string,
        calleeId: row.callee_id as string,
        callLine: row.call_line as number,
        callType: row.call_type as CallRelation['callType'],
        callExpression: row.call_expression as string | undefined,
      });
    }
    
    stmt.free();
    return results;
  }
  
  /**
   * 获取被调用者（这个符号调用了谁）
   */
  getCallees(symbolId: string): CallRelation[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: CallRelation[] = [];
    const stmt = this.db.prepare('SELECT * FROM call_relations WHERE caller_id = ?');
    stmt.bind([symbolId]);
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        callerId: row.caller_id as string,
        calleeId: row.callee_id as string,
        callLine: row.call_line as number,
        callType: row.call_type as CallRelation['callType'],
        callExpression: row.call_expression as string | undefined,
      });
    }
    
    stmt.free();
    return results;
  }
  
  // ============ 文件依赖操作 ============
  
  /**
   * 保存文件依赖
   */
  saveFileDependency(dep: FileDependency): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(`
      INSERT INTO file_dependencies (source_file, target_file, dep_type, imported_symbols, is_type_only)
      VALUES (?, ?, ?, ?, ?)
    `, [
      dep.sourceFile,
      dep.targetFile,
      dep.type,
      dep.importedSymbols ? JSON.stringify(dep.importedSymbols) : null,
      dep.isTypeOnly ? 1 : 0,
    ]);
  }
  
  /**
   * 批量保存文件依赖
   */
  saveFileDependencies(deps: FileDependency[]): void {
    for (const dep of deps) {
      this.saveFileDependency(dep);
    }
  }
  
  /**
   * 获取文件的依赖（这个文件依赖了哪些文件）
   */
  getFileDependencies(filePath: string): FileDependency[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: FileDependency[] = [];
    const stmt = this.db.prepare('SELECT * FROM file_dependencies WHERE source_file = ?');
    stmt.bind([filePath]);
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        sourceFile: row.source_file as string,
        targetFile: row.target_file as string,
        type: row.dep_type as FileDependency['type'],
        importedSymbols: row.imported_symbols ? JSON.parse(row.imported_symbols) : undefined,
        isTypeOnly: !!row.is_type_only,
      });
    }
    
    stmt.free();
    return results;
  }
  
  /**
   * 获取反向依赖（哪些文件依赖了这个文件）
   */
  getFileDependents(filePath: string): FileDependency[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: FileDependency[] = [];
    const stmt = this.db.prepare('SELECT * FROM file_dependencies WHERE target_file LIKE ?');
    stmt.bind([`%${filePath}%`]); // 模糊匹配，因为可能是相对路径
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        sourceFile: row.source_file as string,
        targetFile: row.target_file as string,
        type: row.dep_type as FileDependency['type'],
        importedSymbols: row.imported_symbols ? JSON.parse(row.imported_symbols) : undefined,
        isTypeOnly: !!row.is_type_only,
      });
    }
    
    stmt.free();
    return results;
  }
  
  // ============ 代码片段操作 ============
  
  /**
   * 保存代码片段
   */
  saveCodeChunk(chunk: CodeChunk): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run(`
      INSERT OR REPLACE INTO code_chunks 
      (id, symbol_id, file_path, start_line, end_line, text, embedding, embedding_model)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      chunk.id,
      chunk.symbolId || null,
      chunk.filePath,
      chunk.startLine,
      chunk.endLine,
      chunk.text,
      chunk.embedding ? new Uint8Array(new Float32Array(chunk.embedding).buffer) : null,
      chunk.embeddingModel || null,
    ]);
  }
  
  /**
   * 批量保存代码片段
   */
  saveCodeChunks(chunks: CodeChunk[]): void {
    for (const chunk of chunks) {
      this.saveCodeChunk(chunk);
    }
  }
  
  /**
   * 获取文件的代码片段
   */
  getCodeChunksInFile(filePath: string): CodeChunk[] {
    if (!this.db) throw new Error('Database not initialized');
    
    const results: CodeChunk[] = [];
    const stmt = this.db.prepare('SELECT * FROM code_chunks WHERE file_path = ? ORDER BY start_line');
    stmt.bind([filePath]);
    
    while (stmt.step()) {
      const row = stmt.getAsObject();
      results.push({
        id: row.id as string,
        symbolId: row.symbol_id as string | undefined,
        filePath: row.file_path as string,
        startLine: row.start_line as number,
        endLine: row.end_line as number,
        text: row.text as string,
        embedding: row.embedding ? Array.from(new Float32Array((row.embedding as Uint8Array).buffer)) : undefined,
        embeddingModel: row.embedding_model as string | undefined,
      });
    }
    
    stmt.free();
    return results;
  }
  
  // ============ 统计信息 ============
  
  /**
   * 获取索引统计
   */
  getStats(): {
    totalFiles: number;
    totalSymbols: number;
    totalCallRelations: number;
    totalDependencies: number;
    totalChunks: number;
  } {
    if (!this.db) throw new Error('Database not initialized');
    
    const getCount = (table: string): number => {
      const result = this.db!.exec(`SELECT COUNT(*) as count FROM ${table}`);
      return result[0]?.values[0]?.[0] as number || 0;
    };
    
    return {
      totalFiles: getCount('file_index'),
      totalSymbols: getCount('symbols'),
      totalCallRelations: getCount('call_relations'),
      totalDependencies: getCount('file_dependencies'),
      totalChunks: getCount('code_chunks'),
    };
  }
  
  // ============ 生命周期 ============
  
  /**
   * 导出数据库
   */
  export(): Uint8Array | null {
    if (!this.db) return null;
    return this.db.export();
  }
  
  /**
   * 从数据加载
   */
  async loadFrom(data: Uint8Array): Promise<void> {
    if (!this.sqlJs) {
      const initSqlJs = require('sql.js');
      this.sqlJs = await initSqlJs();
    }
    
    this.db = new this.sqlJs!.Database(data);
    this.initialized = true;
  }
  
  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }
  
  /**
   * 清空所有数据
   */
  clear(): void {
    if (!this.db) throw new Error('Database not initialized');
    
    this.db.run('DELETE FROM code_chunks');
    this.db.run('DELETE FROM call_relations');
    this.db.run('DELETE FROM file_dependencies');
    this.db.run('DELETE FROM symbols');
    this.db.run('DELETE FROM file_index');
  }
}

/** 创建存储实例 */
export function createIndexStore(config?: Partial<StoreConfig>): IndexStore {
  return new IndexStore(config);
}
