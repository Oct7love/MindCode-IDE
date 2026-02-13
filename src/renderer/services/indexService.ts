/**
 * 代码索引服务客户端
 * 渲染进程使用的索引 API
 */

import { create } from "zustand";

/** 索引状态 */
interface IndexState {
  /** 索引状态 */
  status: "idle" | "scanning" | "indexing" | "complete" | "error";
  /** 总文件数 */
  totalFiles: number;
  /** 已索引文件数 */
  indexedFiles: number;
  /** 当前正在索引的文件 */
  currentFile?: string;
  /** 索引统计 */
  stats: {
    totalFiles: number;
    totalSymbols: number;
    totalCallRelations: number;
    totalDependencies: number;
    totalChunks: number;
  };
  /** 错误信息 */
  error?: string;
}

/** 索引 Store */
interface IndexStore extends IndexState {
  /** 开始索引 */
  startIndexing: (workspacePath: string) => Promise<void>;
  /** 取消索引 */
  cancelIndexing: () => Promise<void>;
  /** 清空索引 */
  clearIndex: () => Promise<void>;
  /** 更新进度 */
  updateProgress: (progress: Partial<IndexState>) => void;
  /** 刷新统计 */
  refreshStats: () => Promise<void>;
}

/** 索引状态 Store */
export const useIndexStore = create<IndexStore>((set, get) => ({
  status: "idle",
  totalFiles: 0,
  indexedFiles: 0,
  currentFile: undefined,
  stats: {
    totalFiles: 0,
    totalSymbols: 0,
    totalCallRelations: 0,
    totalDependencies: 0,
    totalChunks: 0,
  },
  error: undefined,

  startIndexing: async (workspacePath: string) => {
    if (!window.mindcode?.index) {
      console.warn("[IndexService] 索引服务不可用");
      return;
    }

    set({ status: "scanning", error: undefined });

    try {
      const result = await window.mindcode.index.indexWorkspace(workspacePath);
      if (!result.success) {
        set({ status: "error", error: result.error });
      }
    } catch (err: any) {
      set({ status: "error", error: err.message });
    }
  },

  cancelIndexing: async () => {
    if (!window.mindcode?.index) return;

    try {
      await window.mindcode.index.cancel();
      set({ status: "idle" });
    } catch (err: any) {
      console.error("[IndexService] 取消索引失败:", err);
    }
  },

  clearIndex: async () => {
    if (!window.mindcode?.index) return;

    try {
      await window.mindcode.index.clear();
      set({
        status: "idle",
        totalFiles: 0,
        indexedFiles: 0,
        stats: {
          totalFiles: 0,
          totalSymbols: 0,
          totalCallRelations: 0,
          totalDependencies: 0,
          totalChunks: 0,
        },
      });
    } catch (err: any) {
      console.error("[IndexService] 清空索引失败:", err);
    }
  },

  updateProgress: (progress: Partial<IndexState>) => {
    set(progress);
  },

  refreshStats: async () => {
    if (!window.mindcode?.index) return;

    try {
      const stats = await window.mindcode.index.getStats();
      set({ stats });
    } catch (err: any) {
      console.error("[IndexService] 获取统计失败:", err);
    }
  },
}));

/** 初始化索引服务监听器 */
export function initIndexServiceListeners(): () => void {
  if (!window.mindcode?.index) {
    console.warn("[IndexService] 索引服务不可用");
    return () => {};
  }

  const store = useIndexStore.getState();

  // 监听进度
  const cleanupProgress = window.mindcode.index.onProgress((progress) => {
    store.updateProgress({
      status: progress.status as IndexState["status"],
      totalFiles: progress.totalFiles,
      indexedFiles: progress.indexedFiles,
      currentFile: progress.currentFile,
    });
  });

  // 监听完成
  const cleanupComplete = window.mindcode.index.onComplete((stats) => {
    store.updateProgress({ status: "complete" });
    store.refreshStats();
    console.log(
      `[IndexService] 索引完成: ${stats.files} 文件, ${stats.symbols} 符号, 耗时 ${stats.time}ms`,
    );
  });

  return () => {
    cleanupProgress();
    cleanupComplete();
  };
}

// ============ 搜索 API ============

/** 搜索代码 */
export async function searchCode(
  query: string,
  options?: {
    type?: "symbol" | "semantic" | "hybrid";
    limit?: number;
    fileFilter?: string[];
    kindFilter?: string[];
  },
) {
  if (!window.mindcode?.index) {
    return { items: [], totalCount: 0, timeTaken: 0, hasMore: false };
  }

  const result = await window.mindcode.index.search({
    query,
    type: options?.type,
    limit: options?.limit,
    fileFilter: options?.fileFilter,
    kindFilter: options?.kindFilter,
  });

  if (result.success && result.data) {
    return result.data;
  }

  return { items: [], totalCount: 0, timeTaken: 0, hasMore: false };
}

/** 搜索符号 */
export async function searchSymbols(name: string, limit = 20) {
  if (!window.mindcode?.index) {
    return [];
  }

  const result = await window.mindcode.index.searchSymbols(name, limit);
  return result.success ? result.data || [] : [];
}

/** 获取文件符号（大纲） */
export async function getFileSymbols(filePath: string) {
  if (!window.mindcode?.index) {
    return [];
  }

  const result = await window.mindcode.index.getFileSymbols(filePath);
  return result.success ? result.data || [] : [];
}

/** 查找定义 */
export async function findDefinition(symbolName: string) {
  if (!window.mindcode?.index) {
    return null;
  }

  const result = await window.mindcode.index.findDefinition(symbolName);
  return result.success ? result.data : null;
}

/** 查找引用 */
export async function findReferences(symbolId: string) {
  if (!window.mindcode?.index) {
    return [];
  }

  const result = await window.mindcode.index.findReferences(symbolId);
  return result.success ? result.data || [] : [];
}

/** 获取相关代码（用于 @codebase） */
export async function getRelatedCode(
  query: string,
  limit = 10,
): Promise<
  Array<{
    filePath: string;
    code: string;
    relevance: number;
  }>
> {
  if (!window.mindcode?.index) {
    return [];
  }

  const result = await window.mindcode.index.getRelatedCode(query, limit);
  return result.success ? result.data || [] : [];
}

// ============ @codebase 上下文收集 ============

/** @codebase 上下文 */
export interface CodebaseContext {
  /** 相关代码片段 */
  snippets: Array<{
    filePath: string;
    code: string;
    relevance: number;
  }>;
  /** 相关符号 */
  symbols: Array<{
    name: string;
    kind: string;
    filePath: string;
    signature?: string;
  }>;
  /** 总 Token 估算 */
  estimatedTokens: number;
}

/**
 * 收集 @codebase 上下文
 * 根据用户查询自动收集相关代码
 */
export async function collectCodebaseContext(
  query: string,
  options?: {
    maxSnippets?: number;
    maxTokens?: number;
  },
): Promise<CodebaseContext> {
  const maxSnippets = options?.maxSnippets || 10;
  const maxTokens = options?.maxTokens || 8000;

  // 并行获取相关代码和符号
  const [relatedCode, searchResults] = await Promise.all([
    getRelatedCode(query, maxSnippets),
    searchCode(query, { type: "hybrid", limit: 20 }),
  ]);

  // 提取符号信息
  const symbols = searchResults.items
    .filter((item) => "kind" in item.item)
    .slice(0, 10)
    .map((item) => ({
      name: item.item.name,
      kind: item.item.kind,
      filePath: item.item.filePath,
      signature: item.item.signature,
    }));

  // 估算 Token（粗略：4 字符 ≈ 1 Token）
  let estimatedTokens = 0;
  const snippets: CodebaseContext["snippets"] = [];

  for (const snippet of relatedCode) {
    const snippetTokens = Math.ceil(snippet.code.length / 4);

    if (estimatedTokens + snippetTokens > maxTokens) {
      break;
    }

    snippets.push(snippet);
    estimatedTokens += snippetTokens;
  }

  return {
    snippets,
    symbols,
    estimatedTokens,
  };
}

/**
 * 格式化 @codebase 上下文为提示词
 */
export function formatCodebaseContext(context: CodebaseContext): string {
  const parts: string[] = [];

  // 添加相关符号摘要
  if (context.symbols.length > 0) {
    parts.push("### 相关符号\n");
    for (const symbol of context.symbols.slice(0, 5)) {
      parts.push(`- ${symbol.kind} \`${symbol.name}\` in \`${symbol.filePath}\``);
      if (symbol.signature) {
        parts.push(`  ${symbol.signature}`);
      }
    }
    parts.push("");
  }

  // 添加相关代码
  if (context.snippets.length > 0) {
    parts.push("### 相关代码\n");
    for (const snippet of context.snippets) {
      const lang = snippet.filePath.split(".").pop() || "text";
      parts.push(`**${snippet.filePath}** (相关度: ${(snippet.relevance * 100).toFixed(0)}%)`);
      parts.push("```" + lang);
      parts.push(snippet.code);
      parts.push("```");
      parts.push("");
    }
  }

  return parts.join("\n");
}
