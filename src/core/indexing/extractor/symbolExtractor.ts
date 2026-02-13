/**
 * 符号提取器
 * 从解析结果中提取和组织符号信息
 */

import type { CodeSymbol, CodeChunk, CallRelation, FileDependency, SymbolKind } from "../types";
import type { ParseResult } from "../parser/typescript";
import { TypeScriptParser } from "../parser/typescript";
import * as crypto from "crypto";

/** 提取配置 */
export interface ExtractorConfig {
  /** 代码片段最小行数 */
  minChunkLines: number;
  /** 代码片段最大行数 */
  maxChunkLines: number;
  /** 是否提取调用关系 */
  extractCalls: boolean;
  /** 是否提取依赖关系 */
  extractDependencies: boolean;
}

const DEFAULT_CONFIG: ExtractorConfig = {
  minChunkLines: 3,
  maxChunkLines: 50,
  extractCalls: true,
  extractDependencies: true,
};

/** 符号提取器 */
export class SymbolExtractor {
  private tsParser: TypeScriptParser;
  private config: ExtractorConfig;

  constructor(config: Partial<ExtractorConfig> = {}) {
    this.tsParser = new TypeScriptParser();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 提取文件中的符号信息
   */
  extract(
    filePath: string,
    sourceCode: string,
  ): {
    symbols: CodeSymbol[];
    chunks: CodeChunk[];
    dependencies: FileDependency[];
    callRelations: CallRelation[];
    contentHash: string;
  } {
    // 计算内容哈希
    const contentHash = this.computeHash(sourceCode);

    // 检测语言
    const language = this.detectLanguage(filePath);

    let parseResult: ParseResult;

    // 根据语言选择解析器
    if (language === "typescript" || language === "javascript") {
      parseResult = this.tsParser.parse(filePath, sourceCode);
    } else {
      // 其他语言暂时用简单的提取
      parseResult = this.simpleExtract(filePath, sourceCode);
    }

    // 生成代码片段
    const chunks = this.generateChunks(filePath, sourceCode, parseResult.symbols);

    return {
      symbols: parseResult.symbols,
      chunks,
      dependencies: this.config.extractDependencies ? parseResult.dependencies : [],
      callRelations: this.config.extractCalls ? parseResult.callRelations : [],
      contentHash,
    };
  }

  /**
   * 检测文件语言
   */
  private detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";

    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      py: "python",
      go: "go",
      rs: "rust",
      java: "java",
      c: "c",
      cpp: "cpp",
      cc: "cpp",
      cxx: "cpp",
      h: "c",
      hpp: "cpp",
      hxx: "cpp",
      cs: "csharp",
      rb: "ruby",
      php: "php",
      swift: "swift",
      kt: "kotlin",
      scala: "scala",
      vue: "vue",
      svelte: "svelte",
    };

    return langMap[ext] || "unknown";
  }

  /**
   * 简单提取（用于不支持 AST 的语言）
   */
  private simpleExtract(filePath: string, sourceCode: string): ParseResult {
    const symbols: CodeSymbol[] = [];
    const lines = sourceCode.split("\n");

    // 使用正则匹配常见的函数/类定义
    const patterns: Array<{ regex: RegExp; kind: SymbolKind }> = [
      // Python: def function_name
      { regex: /^\s*def\s+(\w+)\s*\(/gm, kind: "function" },
      // Python: class ClassName
      { regex: /^\s*class\s+(\w+)/gm, kind: "class" },
      // Go: func functionName
      { regex: /^\s*func\s+(\w+)\s*\(/gm, kind: "function" },
      // Go: func (receiver) methodName
      { regex: /^\s*func\s+\([^)]+\)\s*(\w+)\s*\(/gm, kind: "method" },
      // Go: type TypeName struct
      { regex: /^\s*type\s+(\w+)\s+struct/gm, kind: "class" },
      // Go: type TypeName interface
      { regex: /^\s*type\s+(\w+)\s+interface/gm, kind: "interface" },
      // Rust: fn function_name
      { regex: /^\s*(?:pub\s+)?fn\s+(\w+)/gm, kind: "function" },
      // Rust: struct StructName
      { regex: /^\s*(?:pub\s+)?struct\s+(\w+)/gm, kind: "class" },
      // Rust: trait TraitName
      { regex: /^\s*(?:pub\s+)?trait\s+(\w+)/gm, kind: "interface" },
      // Rust: impl
      { regex: /^\s*impl(?:<[^>]+>)?\s+(\w+)/gm, kind: "class" },
      // Java/C#: class ClassName
      { regex: /^\s*(?:public|private|protected)?\s*class\s+(\w+)/gm, kind: "class" },
      // Java/C#: interface InterfaceName
      { regex: /^\s*(?:public|private|protected)?\s*interface\s+(\w+)/gm, kind: "interface" },
      // C/C++: function definition (简化)
      { regex: /^\s*(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*\{/gm, kind: "function" },
    ];

    let symbolId = 0;

    for (const { regex, kind } of patterns) {
      let match;
      regex.lastIndex = 0;

      while ((match = regex.exec(sourceCode)) !== null) {
        const name = match[1];
        const startIndex = match.index;
        const startLine = sourceCode.substring(0, startIndex).split("\n").length;

        // 估算结束行（找到下一个同级定义或文件结尾）
        const endLine = this.estimateEndLine(sourceCode, startLine, lines.length);

        symbols.push({
          id: `${filePath}#${++symbolId}`,
          name,
          kind,
          filePath,
          startLine,
          endLine,
          startColumn: 1,
          endColumn: lines[endLine - 1]?.length || 1,
        });
      }
    }

    return {
      symbols,
      dependencies: [],
      callRelations: [],
      errors: [],
    };
  }

  /**
   * 估算符号结束行
   */
  private estimateEndLine(sourceCode: string, startLine: number, totalLines: number): number {
    const lines = sourceCode.split("\n");
    let braceCount = 0;
    let started = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];

      for (const char of line) {
        if (char === "{") {
          braceCount++;
          started = true;
        } else if (char === "}") {
          braceCount--;
          if (started && braceCount === 0) {
            return i + 1;
          }
        }
      }
    }

    // 如果没有找到配对的大括号，返回开始后 20 行或文件末尾
    return Math.min(startLine + 20, totalLines);
  }

  /**
   * 生成代码片段
   */
  private generateChunks(filePath: string, sourceCode: string, symbols: CodeSymbol[]): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = sourceCode.split("\n");
    let chunkId = 0;

    // 1. 为每个符号生成片段
    for (const symbol of symbols) {
      const chunkLines = symbol.endLine - symbol.startLine + 1;

      // 符号太短，跳过
      if (chunkLines < this.config.minChunkLines) continue;

      // 符号太长，分割
      if (chunkLines > this.config.maxChunkLines) {
        // 分割成多个片段
        for (
          let start = symbol.startLine;
          start <= symbol.endLine;
          start += this.config.maxChunkLines
        ) {
          const end = Math.min(start + this.config.maxChunkLines - 1, symbol.endLine);
          const text = lines.slice(start - 1, end).join("\n");

          chunks.push({
            id: `${filePath}#chunk${++chunkId}`,
            symbolId: symbol.id,
            filePath,
            startLine: start,
            endLine: end,
            text,
          });
        }
      } else {
        // 正常大小的符号
        const text = lines.slice(symbol.startLine - 1, symbol.endLine).join("\n");

        chunks.push({
          id: `${filePath}#chunk${++chunkId}`,
          symbolId: symbol.id,
          filePath,
          startLine: symbol.startLine,
          endLine: symbol.endLine,
          text,
        });
      }
    }

    // 2. 如果文件没有符号或符号覆盖不完整，添加文件级片段
    if (chunks.length === 0 && lines.length >= this.config.minChunkLines) {
      for (let start = 1; start <= lines.length; start += this.config.maxChunkLines) {
        const end = Math.min(start + this.config.maxChunkLines - 1, lines.length);
        const text = lines.slice(start - 1, end).join("\n");

        chunks.push({
          id: `${filePath}#chunk${++chunkId}`,
          filePath,
          startLine: start,
          endLine: end,
          text,
        });
      }
    }

    return chunks;
  }

  /**
   * 计算内容哈希
   */
  private computeHash(content: string): string {
    return crypto.createHash("md5").update(content).digest("hex");
  }

  /**
   * 构建符号树（按父子关系组织）
   */
  buildSymbolTree(symbols: CodeSymbol[]): Map<string | null, CodeSymbol[]> {
    const tree = new Map<string | null, CodeSymbol[]>();

    for (const symbol of symbols) {
      const parentId = symbol.parentId || null;
      if (!tree.has(parentId)) {
        tree.set(parentId, []);
      }
      tree.get(parentId)!.push(symbol);
    }

    return tree;
  }

  /**
   * 获取符号的完整路径（如 Class.method）
   */
  getSymbolPath(symbol: CodeSymbol, allSymbols: CodeSymbol[]): string {
    const parts: string[] = [symbol.name];
    let current = symbol;

    while (current.parentId) {
      const parent = allSymbols.find((s) => s.id === current.parentId);
      if (parent) {
        parts.unshift(parent.name);
        current = parent;
      } else {
        break;
      }
    }

    return parts.join(".");
  }
}

/** 创建符号提取器 */
export function createSymbolExtractor(config?: Partial<ExtractorConfig>): SymbolExtractor {
  return new SymbolExtractor(config);
}
