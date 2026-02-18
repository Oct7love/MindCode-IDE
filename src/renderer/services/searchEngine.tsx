/**
 * SearchEngine - 搜索引擎服务
 */

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  include?: string;
  exclude?: string;
  maxResults?: number;
}
export interface SearchMatch {
  line: number;
  column: number;
  length: number;
  text: string;
  before?: string;
  after?: string;
}
export interface SearchResult {
  file: string;
  matches: SearchMatch[];
}
export interface ReplaceResult {
  file: string;
  replacements: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;

class SearchEngine {
  private abortController: AbortController | null = null;

  /** 搜索文本 */
  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!query) return [];
    this.abort(); // 取消之前的搜索
    this.abortController = new AbortController();

    const {
      caseSensitive = false,
      wholeWord = false,
      regex = false,
      include,
      exclude,
      maxResults = 1000,
    } = options;

    try {
      // 构建正则
      let pattern: RegExp;
      if (regex) {
        try {
          pattern = new RegExp(query, caseSensitive ? "g" : "gi");
        } catch (err) {
          console.warn(
            "[SearchEngine] Invalid regex pattern:",
            err instanceof Error ? err.message : err,
          );
          return [];
        }
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const wordBoundary = wholeWord ? "\\b" : "";
        pattern = new RegExp(
          `${wordBoundary}${escaped}${wordBoundary}`,
          caseSensitive ? "g" : "gi",
        );
      }

      // 调用后端搜索
      if (win.mindcode?.search?.files) {
        const results = await win.mindcode.search.files(query, {
          caseSensitive,
          wholeWord,
          regex,
          include,
          exclude,
          maxResults,
        });
        return results || [];
      }

      // 本地模拟搜索（仅供测试）
      return this.localSearch(pattern, options);
    } catch (e) {
      if ((e as Error).name === "AbortError") return [];
      console.error("[SearchEngine] Search failed:", e);
      return [];
    }
  }

  /** 在单文件中搜索 */
  searchInContent(content: string, query: string, options: SearchOptions = {}): SearchMatch[] {
    const { caseSensitive = false, wholeWord = false, regex = false } = options;
    const matches: SearchMatch[] = [];

    let pattern: RegExp;
    try {
      if (regex) {
        pattern = new RegExp(query, caseSensitive ? "g" : "gi");
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const wordBoundary = wholeWord ? "\\b" : "";
        pattern = new RegExp(
          `${wordBoundary}${escaped}${wordBoundary}`,
          caseSensitive ? "g" : "gi",
        );
      }
    } catch (err) {
      console.warn(
        "[SearchEngine] Invalid search pattern:",
        err instanceof Error ? err.message : err,
      );
      return [];
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match;
      pattern.lastIndex = 0;
      while ((match = pattern.exec(line)) !== null) {
        matches.push({
          line: i + 1,
          column: match.index + 1,
          length: match[0].length,
          text: match[0],
          before: line.slice(Math.max(0, match.index - 20), match.index),
          after: line.slice(match.index + match[0].length, match.index + match[0].length + 20),
        });
        if (matches.length >= 10000) return matches; // 单文件限制
      }
    }
    return matches;
  }

  /** 替换 */
  async replace(
    query: string,
    replacement: string,
    options: SearchOptions = {},
  ): Promise<ReplaceResult[]> {
    const searchResults = await this.search(query, options);
    const results: ReplaceResult[] = [];

    for (const result of searchResults) {
      try {
        if (win.mindcode?.fs?.readFile && win.mindcode?.fs?.writeFile) {
          const content = await win.mindcode.fs.readFile(result.file);
          const newContent = this.replaceInContent(content, query, replacement, options);
          if (newContent !== content) {
            await win.mindcode.fs.writeFile(result.file, newContent);
            results.push({ file: result.file, replacements: result.matches.length });
          }
        }
      } catch (e) {
        console.error(`[SearchEngine] Replace failed in ${result.file}:`, e);
      }
    }
    return results;
  }

  /** 在内容中替换 */
  replaceInContent(
    content: string,
    query: string,
    replacement: string,
    options: SearchOptions = {},
  ): string {
    const { caseSensitive = false, wholeWord = false, regex = false } = options;

    let pattern: RegExp;
    try {
      if (regex) {
        pattern = new RegExp(query, caseSensitive ? "g" : "gi");
      } else {
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const wordBoundary = wholeWord ? "\\b" : "";
        pattern = new RegExp(
          `${wordBoundary}${escaped}${wordBoundary}`,
          caseSensitive ? "g" : "gi",
        );
      }
    } catch (err) {
      console.warn(
        "[SearchEngine] Invalid replace pattern:",
        err instanceof Error ? err.message : err,
      );
      return content;
    }

    return content.replace(pattern, replacement);
  }

  /** 模糊搜索（文件名） */
  fuzzyMatch(query: string, text: string): { match: boolean; score: number; indices: number[] } {
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    const indices: number[] = [];
    let score = 0;
    let queryIndex = 0;

    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        indices.push(i);
        score +=
          i === 0 || text[i - 1] === "/" || text[i - 1] === "\\" || text[i - 1] === "." ? 10 : 1; // 边界加分
        if (queryIndex > 0 && indices[queryIndex - 1] === i - 1) score += 5; // 连续加分
        queryIndex++;
      }
    }

    return { match: queryIndex === queryLower.length, score, indices };
  }

  /** 取消搜索 */
  abort(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  private async localSearch(_pattern: RegExp, _options: SearchOptions): Promise<SearchResult[]> {
    // 本地模拟实现（实际应由后端处理）
    return [];
  }
}

export const searchEngine = new SearchEngine();

// ============ 高亮工具 ============
export const highlightMatches = (text: string, indices: number[]): React.ReactNode[] => {
  const result: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const i of indices) {
    if (i > lastIndex) result.push(text.slice(lastIndex, i));
    result.push(
      <mark key={i} className="bg-[var(--color-accent-primary)] bg-opacity-30 text-inherit">
        {text[i]}
      </mark>,
    );
    lastIndex = i + 1;
  }
  if (lastIndex < text.length) result.push(text.slice(lastIndex));
  return result;
};

export default searchEngine;
