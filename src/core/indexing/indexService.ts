/**
 * 代码索引服务 - 支持增量索引
 */

import * as path from "path";
import * as fs from "fs";
import type { FSWatcher } from "chokidar";
import { watch } from "chokidar";
import type {
  IndexConfig,
  IndexProgress,
  FileIndex,
  CodeSymbol,
  SearchQuery,
  SearchResults,
} from "./types";
import type { IndexStore } from "./storage/sqliteStore";
import { createIndexStore } from "./storage/sqliteStore";
import type { SymbolExtractor } from "./extractor/symbolExtractor";
import { createSymbolExtractor } from "./extractor/symbolExtractor";
import type { HybridSearch } from "./search/hybridSearch";
import { createHybridSearch } from "./search/hybridSearch";
import { getEmbeddingsService } from "./embeddings";

/** 索引服务事件 */
export interface IndexServiceEvents {
  onProgress: (progress: IndexProgress) => void;
  onFileIndexed: (filePath: string, symbols: number) => void;
  onError: (error: Error, filePath?: string) => void;
  onComplete: (stats: { files: number; symbols: number; time: number }) => void;
  onFileChanged: (filePath: string, changeType: "add" | "change" | "unlink") => void; // 增量索引事件
}

/** OOM 防护配置 */
const INDEX_LIMITS = {
  MAX_FILES: 10000, // 最大索引文件数
  MAX_SYMBOLS: 200000, // 最大符号数
  MAX_MEMORY_MB: 512, // 内存使用上限 (MB)
};

/** 索引服务 */
export class IndexService {
  private store: IndexStore;
  private extractor: SymbolExtractor;
  private search: HybridSearch;
  private config: IndexConfig;
  private isIndexing = false;
  private abortController: AbortController | null = null;
  private progress: IndexProgress = { totalFiles: 0, indexedFiles: 0, status: "idle" };
  private events: Partial<IndexServiceEvents> = {};
  private watcher: FSWatcher | null = null; // chokidar 文件监听器
  private watchRoot: string | null = null; // 监听的根目录
  private pendingUpdates = new Map<string, NodeJS.Timeout>(); // 防抖更新队列
  private totalSymbolCount = 0; // 运行时符号计数

  constructor(config: Partial<IndexConfig> = {}) {
    this.config = {
      includePatterns: [
        "**/*.ts",
        "**/*.tsx",
        "**/*.js",
        "**/*.jsx",
        "**/*.py",
        "**/*.go",
        "**/*.rs",
        "**/*.java",
        "**/*.c",
        "**/*.cpp",
        "**/*.h",
        "**/*.hpp",
      ],
      excludePatterns: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.git/**",
        "**/coverage/**",
        "**/*.min.js",
      ],
      maxFileSize: 1024 * 1024, // 1MB
      enableEmbeddings: true, // 启用向量索引增强语义搜索
      embeddingModel: "text-embedding-3-small",
      incrementalIndex: true,
      concurrency: 4,
      supportedLanguages: ["typescript", "javascript", "python", "go", "rust", "java", "c", "cpp"],
      ...config,
    };

    this.store = createIndexStore();
    this.extractor = createSymbolExtractor();
    this.search = createHybridSearch(this.store);
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    await this.store.initialize();
    console.log("[IndexService] 索引服务初始化完成");
  }

  /**
   * 设置事件监听
   */
  on<K extends keyof IndexServiceEvents>(event: K, handler: IndexServiceEvents[K]): void {
    this.events[event] = handler;
  }

  /**
   * 索引整个目录
   */
  async indexDirectory(rootPath: string): Promise<void> {
    if (this.isIndexing) {
      console.warn("[IndexService] 正在索引中，请稍候");
      return;
    }

    this.isIndexing = true;
    this.abortController = new AbortController();
    const startTime = Date.now();

    try {
      // 1. 扫描文件
      this.updateProgress({ status: "scanning", startTime });
      const files = await this.scanFiles(rootPath);

      this.updateProgress({
        totalFiles: files.length,
        indexedFiles: 0,
        status: "indexing",
      });

      // OOM 防护：文件数量上限
      const filesToIndex =
        files.length > INDEX_LIMITS.MAX_FILES
          ? (console.warn(
              `[IndexService] 文件数 ${files.length} 超过上限 ${INDEX_LIMITS.MAX_FILES}，仅索引前 ${INDEX_LIMITS.MAX_FILES} 个`,
            ),
            files.slice(0, INDEX_LIMITS.MAX_FILES))
          : files;

      console.log(`[IndexService] 扫描到 ${files.length} 个文件，将索引 ${filesToIndex.length} 个`);

      // 2. 索引文件
      let indexedCount = 0;
      let symbolCount = 0;
      for (const filePath of filesToIndex) {
        if (this.abortController.signal.aborted) {
          console.warn("[IndexService] 索引已取消");
          break;
        }

        // OOM 防护：符号数量上限
        if (this.totalSymbolCount > INDEX_LIMITS.MAX_SYMBOLS) {
          console.warn(`[IndexService] 符号数超过上限 ${INDEX_LIMITS.MAX_SYMBOLS}，停止索引`);
          break;
        }

        // OOM 防护：内存使用检查（每 100 个文件检查一次）
        if (indexedCount % 100 === 0 && indexedCount > 0) {
          const memMB = process.memoryUsage().heapUsed / 1024 / 1024;
          if (memMB > INDEX_LIMITS.MAX_MEMORY_MB) {
            console.warn(
              `[IndexService] 内存使用 ${memMB.toFixed(0)}MB 超过上限 ${INDEX_LIMITS.MAX_MEMORY_MB}MB，停止索引`,
            );
            break;
          }
        }

        try {
          const count = await this.indexFile(filePath);
          symbolCount += count;
          this.totalSymbolCount += count;
          indexedCount++;

          this.updateProgress({
            indexedFiles: indexedCount,
            currentFile: filePath,
          });

          this.events.onFileIndexed?.(filePath, count);
        } catch (err) {
          console.error(`[IndexService] 索引文件失败: ${filePath}`, err);
          this.events.onError?.(err as Error, filePath);
        }
      }

      // 3. 完成
      const elapsed = Date.now() - startTime;
      this.updateProgress({ status: "complete" });

      const stats = this.store.getStats();
      console.log(
        `[IndexService] 索引完成: ${stats.totalFiles} 文件, ${stats.totalSymbols} 符号, 耗时 ${elapsed}ms`,
      );

      this.events.onComplete?.({
        files: stats.totalFiles,
        symbols: stats.totalSymbols,
        time: elapsed,
      });
    } finally {
      this.isIndexing = false;
      this.abortController = null;
    }
  }

  /**
   * 索引单个文件
   */
  async indexFile(filePath: string): Promise<number> {
    // 读取文件内容
    const content = await this.readFile(filePath);
    if (!content) return 0;

    // 检查是否需要重新索引
    const existing = this.store.getFileIndex(filePath);
    const result = this.extractor.extract(filePath, content);

    if (existing && existing.contentHash === result.contentHash && this.config.incrementalIndex) {
      // 内容未变，跳过
      return existing.symbolCount;
    }

    // 删除旧数据
    if (existing) {
      this.store.deleteFileIndex(filePath);
    }

    // 保存新数据
    const fileIndex: FileIndex = {
      filePath,
      contentHash: result.contentHash,
      indexedAt: Date.now(),
      symbolCount: result.symbols.length,
      status: "indexed",
      language: this.detectLanguage(filePath),
      fileSize: content.length,
    };

    this.store.saveFileIndex(fileIndex);
    this.store.saveSymbols(result.symbols);
    this.store.saveCallRelations(result.callRelations);
    this.store.saveFileDependencies(result.dependencies);

    // 为代码块生成向量嵌入（如果启用）
    let chunksToSave = result.chunks;
    if (this.config.enableEmbeddings && result.chunks.length > 0) {
      try {
        const embService = getEmbeddingsService({ model: this.config.embeddingModel });
        const texts = result.chunks.map((c) => c.text.slice(0, 2000)); // 截断长文本
        const embeddings = await embService.embedBatch(texts);
        chunksToSave = result.chunks.map((c, i) => ({
          ...c,
          embedding: embeddings[i]?.embedding,
          embeddingModel: this.config.embeddingModel,
        }));
      } catch (e) {
        console.warn("[IndexService] 向量嵌入生成失败，跳过:", e);
      }
    }
    this.store.saveCodeChunks(chunksToSave);

    return result.symbols.length;
  }

  /**
   * 扫描文件
   */
  private async scanFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];

    const scan = async (dir: string) => {
      let entries: string[];

      try {
        entries = fs.readdirSync(dir);
      } catch {
        return;
      }

      for (const entry of entries) {
        const fullPath = path.join(dir, entry);

        // 检查是否排除
        if (this.shouldExclude(fullPath)) continue;

        try {
          const stat = fs.statSync(fullPath);

          if (stat.isDirectory()) {
            await scan(fullPath);
          } else if (stat.isFile()) {
            // 检查文件大小和扩展名
            if (stat.size <= this.config.maxFileSize && this.shouldInclude(fullPath)) {
              files.push(fullPath);
            }
          }
        } catch {
          // 忽略无法访问的文件
        }
      }
    };

    await scan(rootPath);
    return files;
  }

  /**
   * 检查是否应该包含文件
   */
  private shouldInclude(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    const supportedExts = [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".py",
      ".go",
      ".rs",
      ".java",
      ".c",
      ".cpp",
      ".cc",
      ".cxx",
      ".h",
      ".hpp",
      ".hxx",
    ];
    return supportedExts.includes(ext);
  }

  /**
   * 检查是否应该排除
   */
  private shouldExclude(filePath: string): boolean {
    const excludePatterns = [
      "node_modules",
      "dist",
      "build",
      ".git",
      "coverage",
      "__pycache__",
      ".pytest_cache",
      "target",
      "vendor",
      ".next",
      ".nuxt",
      ".output",
      "out",
    ];

    const normalized = filePath.replace(/\\/g, "/");
    return excludePatterns.some(
      (p) => normalized.includes(`/${p}/`) || normalized.includes(`\\${p}\\`),
    );
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const langMap: Record<string, string> = {
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".mjs": "javascript",
      ".cjs": "javascript",
      ".py": "python",
      ".go": "go",
      ".rs": "rust",
      ".java": "java",
      ".c": "c",
      ".h": "c",
      ".cpp": "cpp",
      ".cc": "cpp",
      ".cxx": "cpp",
      ".hpp": "cpp",
      ".hxx": "cpp",
    };
    return langMap[ext] || "unknown";
  }

  /**
   * 读取文件
   */
  private async readFile(filePath: string): Promise<string | null> {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * 更新进度
   */
  private updateProgress(update: Partial<IndexProgress>): void {
    this.progress = { ...this.progress, ...update };
    this.events.onProgress?.(this.progress);
  }

  // ============ 搜索 API ============

  /**
   * 搜索代码
   */
  async searchCode(query: SearchQuery): Promise<SearchResults> {
    return this.search.search(query);
  }

  /**
   * 快速符号搜索
   */
  async searchSymbols(name: string, limit = 20): Promise<CodeSymbol[]> {
    return this.store.searchSymbolsByName(name, limit);
  }

  /**
   * 获取文件符号
   */
  async getFileSymbols(filePath: string): Promise<CodeSymbol[]> {
    return this.store.getSymbolsInFile(filePath);
  }

  /**
   * 查找定义
   */
  async findDefinition(symbolName: string): Promise<CodeSymbol | null> {
    return this.search.findDefinition(symbolName);
  }

  /**
   * 查找引用
   */
  async findReferences(symbolId: string) {
    return this.search.findReferences(symbolId);
  }

  /**
   * 获取相关代码（用于 @codebase）
   */
  async getRelatedCode(query: string, limit = 10) {
    return this.search.getRelatedCode(query, limit);
  }

  // ============ 管理 API ============

  /**
   * 获取当前进度
   */
  getProgress(): IndexProgress {
    return this.progress;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return this.store.getStats();
  }

  /**
   * 取消索引
   */
  cancelIndexing(): void {
    this.abortController?.abort();
  }

  /**
   * 清空索引
   */
  clearIndex(): void {
    this.store.clear();
    this.updateProgress({
      totalFiles: 0,
      indexedFiles: 0,
      status: "idle",
    });
  }

  /**
   * 导出索引数据
   */
  exportIndex(): Uint8Array | null {
    return this.store.export();
  }

  /**
   * 导入索引数据
   */
  async importIndex(data: Uint8Array): Promise<void> {
    await this.store.loadFrom(data);
  }

  /** 关闭服务 */
  close(): void {
    this.stopWatching();
    this.store.close();
  }

  // ============ 增量索引 (chokidar) ============

  /** 启动文件监听（增量索引） */
  startWatching(rootPath: string): void {
    if (this.watcher) this.stopWatching();
    this.watchRoot = rootPath;
    console.log(`[IndexService] 启动文件监听: ${rootPath}`);
    this.watcher = watch(rootPath, {
      ignored: (p: string) => this.shouldExclude(p),
      persistent: true,
      ignoreInitial: true, // 忽略初始扫描
      awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 }, // 等待写入完成
    });
    this.watcher.on("add", (p) => this.handleFileChange(p, "add"));
    this.watcher.on("change", (p) => this.handleFileChange(p, "change"));
    this.watcher.on("unlink", (p) => this.handleFileChange(p, "unlink"));
    this.watcher.on("error", (err) => this.events.onError?.(err as Error));
  }

  /** 停止文件监听 */
  stopWatching(): void {
    if (this.watcher) {
      console.log("[IndexService] 停止文件监听");
      this.watcher.close();
      this.watcher = null;
    }
    this.pendingUpdates.forEach(clearTimeout);
    this.pendingUpdates.clear();
  }

  /** 处理文件变化（防抖 300ms） */
  private handleFileChange(filePath: string, changeType: "add" | "change" | "unlink"): void {
    if (!this.shouldInclude(filePath)) return;
    const existing = this.pendingUpdates.get(filePath);
    if (existing) clearTimeout(existing);
    this.pendingUpdates.set(
      filePath,
      setTimeout(async () => {
        this.pendingUpdates.delete(filePath);
        const startTime = Date.now();
        try {
          if (changeType === "unlink") {
            this.store.deleteFileIndex(filePath);
            console.log(`[IndexService] 文件删除，移除索引: ${filePath}`);
          } else {
            const count = await this.indexFile(filePath);
            console.log(
              `[IndexService] 增量索引完成: ${filePath} (${count} 符号, ${Date.now() - startTime}ms)`,
            );
          }
          this.events.onFileChanged?.(filePath, changeType);
        } catch (err) {
          this.events.onError?.(err as Error, filePath);
        }
      }, 300),
    );
  }

  /** 是否正在监听 */
  isWatching(): boolean {
    return this.watcher !== null;
  }
}

/** 创建索引服务 */
export function createIndexService(config?: Partial<IndexConfig>): IndexService {
  return new IndexService(config);
}

// 单例实例
let indexServiceInstance: IndexService | null = null;

/** 获取索引服务单例 */
export function getIndexService(): IndexService {
  if (!indexServiceInstance) {
    indexServiceInstance = createIndexService();
  }
  return indexServiceInstance;
}
