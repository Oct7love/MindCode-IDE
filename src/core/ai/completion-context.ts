/**
 * Cursor-like Inline Completion 上下文提取
 *
 * 从 Monaco Editor + LSP/TS Server 提取：
 * - Symbols (类、函数、变量、导入)
 * - Diagnostics (错误、警告)
 * - Related Snippets (相关文件片段)
 * - Style Hints (代码风格)
 */

import { detectLanguage } from "./completion-config";
import type { IntentResult } from "./intent-classifier";
import { classifyIntent, extractIntentFromComment } from "./intent-classifier";
import type { DocumentSymbol, Diagnostic as LSPDiagnostic } from "../../core/lsp/types";

// ============================================
// 类型定义
// ============================================

/** 符号类型 */
export type SymbolKind =
  | "class"
  | "interface"
  | "function"
  | "method"
  | "variable"
  | "constant"
  | "import"
  | "type"
  | "enum"
  | "property";

/** 符号信息 */
export interface SymbolInfo {
  name: string;
  kind: SymbolKind;
  signature?: string; // 函数签名 / 类型定义
  line?: number;
  source?: string; // 来源文件（用于 import）
}

/** 诊断严重程度 */
export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";

/** 诊断信息 */
export interface DiagnosticInfo {
  message: string;
  severity: DiagnosticSeverity;
  line: number;
  column: number;
  code?: string | number; // 错误码 (TS2304, E0001)
  source?: string; // 诊断来源 (typescript, eslint)
  suggestion?: string; // 修复建议
}

/** 相关代码片段 */
export interface RelatedSnippet {
  filePath: string;
  content: string;
  relevance: number; // 0-1 相关性分数
  reason: string; // 为什么相关
}

/** 风格提示 */
export interface StyleHints {
  indentStyle: "spaces" | "tabs";
  indentSize: number;
  semicolon: boolean;
  quotes: "single" | "double";
  trailingComma: boolean;
  maxLineLength?: number;
  namingConvention?: string; // camelCase, snake_case, PascalCase
}

/** 补全上下文 */
export interface CompletionContext {
  // 基础信息
  language: string;
  filePath: string;
  cursor: { line: number; column: number };

  // 代码内容
  prefix: string; // 光标前
  suffix: string; // 光标后
  selection?: string; // 选中文本
  currentLine: string; // 当前行

  // 语义信息
  symbols: SymbolInfo[];
  diagnostics: DiagnosticInfo[];
  relatedSnippets: RelatedSnippet[];

  // 风格
  styleHints: StyleHints;

  // 用户意图
  userIntent?: string; // 从注释/自然语言提取（原始文本）
  intent?: IntentResult; // 意图分类结果

  // 元数据
  triggerKind: "auto" | "manual" | "retrigger";
  triggerCharacter?: string;
}

// ============================================
// Monaco Editor 适配器
// ============================================

/**
 * 从 Monaco Editor 提取补全上下文
 */
export function extractContextFromMonaco(
  editor: any, // monaco.editor.IStandaloneCodeEditor
  model: any, // monaco.editor.ITextModel
  position: any, // monaco.Position
): Partial<CompletionContext> {
  const lineNumber = position.lineNumber;
  const column = position.column;

  // 获取前缀和后缀
  const fullText = model.getValue();
  const offset = model.getOffsetAt(position);
  const prefix = fullText.substring(0, offset);
  const suffix = fullText.substring(offset);

  // 当前行
  const currentLine = model.getLineContent(lineNumber);

  // 选中文本
  const selection = editor.getSelection();
  const selectedText =
    selection && !selection.isEmpty() ? model.getValueInRange(selection) : undefined;

  return {
    cursor: { line: lineNumber, column },
    prefix,
    suffix,
    selection: selectedText,
    currentLine,
  };
}

/**
 * 从 Monaco 诊断提取
 */
export function extractDiagnosticsFromMonaco(monaco: any, model: any): DiagnosticInfo[] {
  const markers = monaco.editor.getModelMarkers({ resource: model.uri });

  return markers.map((marker: any) => ({
    message: marker.message,
    severity: mapMonacoSeverity(marker.severity),
    line: marker.startLineNumber,
    column: marker.startColumn,
    code: marker.code,
    source: marker.source,
  }));
}

function mapMonacoSeverity(severity: number): DiagnosticSeverity {
  // Monaco MarkerSeverity: 1=Hint, 2=Info, 4=Warning, 8=Error
  switch (severity) {
    case 8:
      return "error";
    case 4:
      return "warning";
    case 2:
      return "info";
    default:
      return "hint";
  }
}

// ============================================
// 符号提取
// ============================================

/**
 * 从代码中提取符号 (简化版，不依赖 LSP)
 * 生产环境建议使用 Monaco 的 DocumentSymbolProvider
 */
export function extractSymbolsFromCode(code: string, language: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const lines = code.split("\n");

  // 导入语句
  const importPatterns: Record<string, RegExp[]> = {
    typescript: [
      /^import\s+(?:{([^}]+)}\s+from\s+)?['"]([^'"]+)['"]/,
      /^import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/,
      /^import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]/,
    ],
    javascript: [
      /^import\s+(?:{([^}]+)}\s+from\s+)?['"]([^'"]+)['"]/,
      /^const\s+{([^}]+)}\s*=\s*require\(['"]([^'"]+)['"]\)/,
    ],
    python: [/^from\s+(\S+)\s+import\s+(.+)$/, /^import\s+(\S+)(?:\s+as\s+(\w+))?$/],
    go: [/^import\s+"([^"]+)"$/, /^import\s+(\w+)\s+"([^"]+)"$/],
  };

  // 函数/类定义
  const definitionPatterns: Record<string, Array<{ pattern: RegExp; kind: SymbolKind }>> = {
    typescript: [
      { pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: "function" },
      { pattern: /^(?:export\s+)?class\s+(\w+)/, kind: "class" },
      { pattern: /^(?:export\s+)?interface\s+(\w+)/, kind: "interface" },
      { pattern: /^(?:export\s+)?type\s+(\w+)/, kind: "type" },
      { pattern: /^(?:export\s+)?enum\s+(\w+)/, kind: "enum" },
      { pattern: /^(?:export\s+)?const\s+(\w+)\s*=/, kind: "constant" },
      { pattern: /^\s+(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*\S+)?\s*{/, kind: "method" },
    ],
    javascript: [
      { pattern: /^(?:export\s+)?(?:async\s+)?function\s+(\w+)/, kind: "function" },
      { pattern: /^(?:export\s+)?class\s+(\w+)/, kind: "class" },
      { pattern: /^(?:export\s+)?const\s+(\w+)\s*=/, kind: "constant" },
    ],
    python: [
      { pattern: /^(?:async\s+)?def\s+(\w+)/, kind: "function" },
      { pattern: /^class\s+(\w+)/, kind: "class" },
    ],
    go: [
      { pattern: /^func\s+(\w+)/, kind: "function" },
      { pattern: /^func\s+\([^)]+\)\s+(\w+)/, kind: "method" },
      { pattern: /^type\s+(\w+)\s+struct/, kind: "class" },
      { pattern: /^type\s+(\w+)\s+interface/, kind: "interface" },
    ],
    c: [
      { pattern: /^(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*{/, kind: "function" },
      { pattern: /^typedef\s+struct\s+(\w+)/, kind: "class" },
      { pattern: /^#define\s+(\w+)/, kind: "constant" },
    ],
    cpp: [
      { pattern: /^(?:\w+\s+)+(\w+)\s*\([^)]*\)\s*{/, kind: "function" },
      { pattern: /^class\s+(\w+)/, kind: "class" },
      { pattern: /^struct\s+(\w+)/, kind: "class" },
      { pattern: /^namespace\s+(\w+)/, kind: "class" },
    ],
  };

  const langImports = importPatterns[language] || [];
  const langDefs = definitionPatterns[language] || [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    // 检查导入
    for (const pattern of langImports) {
      const match = trimmed.match(pattern);
      if (match) {
        const names = match[1]?.split(",").map((s) => s.trim()) || [match[1]];
        const source = match[2] || match[1];
        names.forEach((name) => {
          if (name) {
            symbols.push({
              name: name.split(" as ").pop()!.trim(),
              kind: "import",
              source,
              line: index + 1,
            });
          }
        });
        break;
      }
    }

    // 检查定义
    for (const { pattern, kind } of langDefs) {
      const match = trimmed.match(pattern);
      if (match && match[1]) {
        symbols.push({
          name: match[1],
          kind,
          line: index + 1,
          signature: trimmed.length < 100 ? trimmed : undefined,
        });
        break;
      }
    }
  });

  return symbols;
}

// ============================================
// 相关片段提取
// ============================================

/**
 * 查找相关代码片段
 *
 * 策略：
 * 1. 同目录文件
 * 2. 被导入的文件
 * 3. 类型定义文件
 */
export async function findRelatedSnippets(
  filePath: string,
  symbols: SymbolInfo[],
  readFile: (path: string) => Promise<string | null>,
  listFiles: (dir: string) => Promise<string[]>,
  maxSnippets: number = 3,
): Promise<RelatedSnippet[]> {
  const snippets: RelatedSnippet[] = [];
  const dir = filePath.substring(0, filePath.lastIndexOf("/"));

  // 1. 从 import 符号找相关文件
  const importedFiles = symbols
    .filter((s) => s.kind === "import" && s.source)
    .map((s) => s.source!)
    .filter((src) => !src.startsWith(".") || src.startsWith("./") || src.startsWith("../"));

  for (const importPath of importedFiles.slice(0, maxSnippets)) {
    // 解析相对路径
    let resolvedPath = importPath;
    if (importPath.startsWith("./")) {
      resolvedPath = `${dir}/${importPath.slice(2)}`;
    } else if (importPath.startsWith("../")) {
      resolvedPath = `${dir}/${importPath}`;
    }

    // 尝试不同扩展名
    const extensions = [".ts", ".tsx", ".js", ".jsx", ""];
    for (const ext of extensions) {
      const fullPath = resolvedPath + ext;
      const content = await readFile(fullPath);
      if (content) {
        snippets.push({
          filePath: fullPath,
          content: extractRelevantPortion(content, 50),
          relevance: 0.9,
          reason: "imported",
        });
        break;
      }
    }

    if (snippets.length >= maxSnippets) break;
  }

  // 2. 同目录文件 (类型定义优先)
  if (snippets.length < maxSnippets) {
    try {
      const files = await listFiles(dir);
      const typeFiles = files.filter(
        (f) => f.endsWith(".d.ts") || f.includes("types") || f.includes("interface"),
      );

      for (const file of typeFiles.slice(0, maxSnippets - snippets.length)) {
        const content = await readFile(`${dir}/${file}`);
        if (content) {
          snippets.push({
            filePath: `${dir}/${file}`,
            content: extractRelevantPortion(content, 30),
            relevance: 0.7,
            reason: "same_directory_types",
          });
        }
      }
    } catch {
      // 忽略文件系统错误
    }
  }

  return snippets;
}

/**
 * 提取文件的相关部分 (导入 + 导出 + 类型定义)
 */
function extractRelevantPortion(content: string, maxLines: number): string {
  const lines = content.split("\n");
  const relevantLines: string[] = [];

  let inExport = false;
  let braceDepth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // 导入语句
    if (trimmed.startsWith("import ") || trimmed.startsWith("from ")) {
      relevantLines.push(line);
      continue;
    }

    // 导出/类型定义
    if (
      trimmed.startsWith("export ") ||
      trimmed.startsWith("interface ") ||
      trimmed.startsWith("type ") ||
      trimmed.startsWith("class ") ||
      trimmed.startsWith("function ") ||
      trimmed.startsWith("const ")
    ) {
      inExport = true;
      braceDepth = 0;
    }

    if (inExport) {
      relevantLines.push(line);
      braceDepth += (line.match(/{/g) || []).length;
      braceDepth -= (line.match(/}/g) || []).length;

      if (braceDepth <= 0 && (trimmed.endsWith(";") || trimmed.endsWith("}"))) {
        inExport = false;
      }
    }

    if (relevantLines.length >= maxLines) break;
  }

  return relevantLines.join("\n");
}

// ============================================
// 风格检测
// ============================================

/**
 * 从代码中检测风格
 */
export function detectStyleHints(code: string): StyleHints {
  const lines = code.split("\n").filter((l) => l.length > 0);

  // 缩进检测
  let spacesCount = 0;
  let tabsCount = 0;
  const indentSizes: number[] = [];

  for (const line of lines) {
    const leadingWhitespace = line.match(/^(\s+)/);
    if (leadingWhitespace) {
      const ws = leadingWhitespace[1];
      if (ws.includes("\t")) {
        tabsCount++;
      } else {
        spacesCount++;
        indentSizes.push(ws.length);
      }
    }
  }

  // 分号检测
  const semicolonLines = lines.filter((l) => l.trim().endsWith(";")).length;
  const noSemicolonLines = lines.filter(
    (l) =>
      l.trim().length > 0 &&
      !l.trim().endsWith(";") &&
      !l.trim().endsWith("{") &&
      !l.trim().endsWith("}") &&
      !l.trim().endsWith(",") &&
      !l.trim().startsWith("//"),
  ).length;

  // 引号检测
  const singleQuotes = (code.match(/'/g) || []).length;
  const doubleQuotes = (code.match(/"/g) || []).length;

  // 尾随逗号检测
  const trailingCommas = (code.match(/,\s*[\]}]/g) || []).length;

  // 计算常见缩进大小
  const indentSize = indentSizes.length > 0 ? Math.min(...indentSizes.filter((s) => s > 0)) : 2;

  return {
    indentStyle: tabsCount > spacesCount ? "tabs" : "spaces",
    indentSize: indentSize || 2,
    semicolon: semicolonLines > noSemicolonLines,
    quotes: singleQuotes > doubleQuotes ? "single" : "double",
    trailingComma: trailingCommas > 0,
  };
}

// ============================================
// 用户意图检测
// ============================================

/**
 * 从光标附近检测用户意图
 */
export function detectUserIntent(currentLine: string, previousLines: string[]): string | undefined {
  const trimmed = currentLine.trim();

  // 注释中的自然语言
  const commentPatterns = [
    /^\/\/\s*(.+)$/, // // comment
    /^#\s*(.+)$/, // # comment
    /^\/\*\s*(.+?)\s*\*?\/?$/, // /* comment */
    /^"""\s*(.+)$/, // """ docstring
    /^'''\s*(.+)$/, // ''' docstring
  ];

  for (const pattern of commentPatterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }

  // 检查上一行是否是注释
  for (let i = previousLines.length - 1; i >= Math.max(0, previousLines.length - 3); i--) {
    const prevTrimmed = previousLines[i].trim();
    for (const pattern of commentPatterns) {
      const match = prevTrimmed.match(pattern);
      if (match) {
        return match[1];
      }
    }
    // 如果遇到非空非注释行，停止
    if (prevTrimmed.length > 0 && !prevTrimmed.startsWith("//") && !prevTrimmed.startsWith("#")) {
      break;
    }
  }

  return undefined;
}

// ============================================
// LSP 数据转换
// ============================================

/** LSP SymbolKind → 内部 SymbolKind 映射 */
const LSP_SYMBOL_KIND_MAP: Record<number, SymbolKind> = {
  5: "class",
  11: "interface",
  12: "function",
  6: "method",
  13: "variable",
  14: "constant",
  26: "type",
  10: "enum",
  7: "property",
};

/** 将 LSP DocumentSymbol 树扁平化为 SymbolInfo[] */
export function convertLSPSymbols(lspSymbols: DocumentSymbol[]): SymbolInfo[] {
  const result: SymbolInfo[] = [];
  const walk = (syms: DocumentSymbol[]) => {
    for (const s of syms) {
      result.push({
        name: s.name,
        kind: LSP_SYMBOL_KIND_MAP[s.kind] || "variable",
        line: s.selectionRange.start.line + 1,
      });
      if (s.children?.length) walk(s.children);
    }
  };
  walk(lspSymbols);
  return result;
}

/** LSP Diagnostic severity → 内部 severity */
const LSP_SEVERITY_MAP: Record<number, DiagnosticSeverity> = {
  1: "error",
  2: "warning",
  3: "info",
  4: "hint",
};

/** 将 LSP Diagnostic[] 转为 DiagnosticInfo[] */
export function convertLSPDiagnostics(lspDiags: LSPDiagnostic[]): DiagnosticInfo[] {
  return lspDiags.map((d) => ({
    message: d.message,
    severity: LSP_SEVERITY_MAP[d.severity || 4] || "hint",
    line: d.range.start.line + 1,
    column: d.range.start.character + 1,
    code: d.code,
    source: d.source,
  }));
}

// ============================================
// 完整上下文构建
// ============================================

/** LSP 数据源接口 */
export interface LSPContextProvider {
  getDocumentSymbols(uri: string): Promise<DocumentSymbol[]>;
  getDiagnostics(uri: string): Promise<LSPDiagnostic[]>;
  getHover?(uri: string, line: number, character: number): Promise<string | null>;
}

/**
 * 构建完整的补全上下文
 * 优先使用 LSP 真实数据，回退到正则提取
 */
export async function buildCompletionContext(
  filePath: string,
  code: string,
  cursorLine: number,
  cursorColumn: number,
  options: {
    maxPrefixLines?: number;
    maxSuffixLines?: number;
    readFile?: (path: string) => Promise<string | null>;
    listFiles?: (dir: string) => Promise<string[]>;
    diagnostics?: DiagnosticInfo[];
    lsp?: LSPContextProvider;
  } = {},
): Promise<CompletionContext> {
  const {
    maxPrefixLines = 100,
    maxSuffixLines = 50,
    readFile,
    listFiles,
    diagnostics: fallbackDiagnostics = [],
    lsp,
  } = options;

  const lines = code.split("\n");
  const language = detectLanguage(filePath);

  // 计算 prefix 和 suffix
  const prefixLines = lines.slice(Math.max(0, cursorLine - maxPrefixLines), cursorLine);
  const currentLineContent = lines[cursorLine] || "";
  const prefixInCurrentLine = currentLineContent.substring(0, cursorColumn - 1);
  const suffixInCurrentLine = currentLineContent.substring(cursorColumn - 1);
  const suffixLines = lines.slice(cursorLine + 1, cursorLine + 1 + maxSuffixLines);

  const prefix = [...prefixLines, prefixInCurrentLine].join("\n");
  const suffix = [suffixInCurrentLine, ...suffixLines].join("\n");

  // 提取符号：优先 LSP，回退正则
  let symbols: SymbolInfo[];
  if (lsp) {
    try {
      const uri = `file:///${filePath.replace(/\\/g, "/")}`;
      const lspSymbols = await lsp.getDocumentSymbols(uri);
      symbols =
        lspSymbols.length > 0
          ? convertLSPSymbols(lspSymbols)
          : extractSymbolsFromCode(code, language);
    } catch {
      symbols = extractSymbolsFromCode(code, language);
    }
  } else {
    symbols = extractSymbolsFromCode(code, language);
  }

  // 提取诊断：优先 LSP，回退传入值
  let diagnostics: DiagnosticInfo[];
  if (lsp) {
    try {
      const uri = `file:///${filePath.replace(/\\/g, "/")}`;
      const lspDiags = await lsp.getDiagnostics(uri);
      diagnostics = lspDiags.length > 0 ? convertLSPDiagnostics(lspDiags) : fallbackDiagnostics;
    } catch {
      diagnostics = fallbackDiagnostics;
    }
  } else {
    diagnostics = fallbackDiagnostics;
  }

  // 检测风格
  const styleHints = detectStyleHints(code);

  // 检测用户意图（原始文本）
  const previousLines = lines.slice(Math.max(0, cursorLine - 5), cursorLine);
  const userIntent = detectUserIntent(currentLineContent, previousLines);

  // 意图分类
  let intent: IntentResult | undefined;
  if (userIntent) {
    intent = extractIntentFromComment(userIntent);
  } else {
    intent = classifyIntent("", {
      currentLine: currentLineContent,
      previousLines,
      diagnostics: diagnostics.map((d) => ({ message: d.message, severity: d.severity })),
      fileName: filePath.split("/").pop() || filePath.split("\\").pop(),
    });
  }

  // LSP hover 增强：获取光标处符号的类型信息
  let hoverHint: string | undefined;
  if (lsp?.getHover) {
    try {
      const uri = `file:///${filePath.replace(/\\/g, "/")}`;
      hoverHint = (await lsp.getHover(uri, cursorLine, cursorColumn - 1)) || undefined;
    } catch {
      /* ignore */
    }
  }
  if (hoverHint) {
    userIntent
      ? undefined
      : symbols.length > 0 &&
        symbols.push({
          name: "_cursor_type_",
          kind: "type",
          signature: hoverHint,
          line: cursorLine + 1,
        });
  }

  // 查找相关片段
  let relatedSnippets: RelatedSnippet[] = [];
  if (readFile && listFiles) {
    relatedSnippets = await findRelatedSnippets(filePath, symbols, readFile, listFiles);
  }

  return {
    language,
    filePath,
    cursor: { line: cursorLine + 1, column: cursorColumn },
    prefix,
    suffix,
    currentLine: currentLineContent,
    symbols,
    diagnostics,
    relatedSnippets,
    styleHints,
    userIntent,
    intent,
    triggerKind: "auto",
  };
}

// ============================================
// 提示词格式化
// ============================================

/**
 * 格式化符号列表为提示词
 */
export function formatSymbolsForPrompt(symbols: SymbolInfo[], maxCount: number = 30): string {
  if (symbols.length === 0) return "(none)";

  const grouped: Record<SymbolKind, SymbolInfo[]> = {
    import: [],
    class: [],
    interface: [],
    type: [],
    enum: [],
    function: [],
    method: [],
    constant: [],
    variable: [],
    property: [],
  };

  for (const sym of symbols) {
    grouped[sym.kind].push(sym);
  }

  const lines: string[] = [];
  let count = 0;

  for (const [kind, syms] of Object.entries(grouped)) {
    if (syms.length === 0 || count >= maxCount) continue;

    const remaining = maxCount - count;
    const toShow = syms.slice(0, remaining);

    for (const sym of toShow) {
      if (sym.signature) {
        lines.push(`${kind}: ${sym.signature}`);
      } else if (sym.source) {
        lines.push(`${kind}: ${sym.name} (from ${sym.source})`);
      } else {
        lines.push(`${kind}: ${sym.name}`);
      }
      count++;
    }
  }

  return lines.join("\n");
}

/**
 * 格式化诊断列表为提示词
 */
export function formatDiagnosticsForPrompt(diagnostics: DiagnosticInfo[]): string {
  if (diagnostics.length === 0) return "(none)";

  return diagnostics
    .slice(0, 10)
    .map(
      (d) =>
        `[${d.severity.toUpperCase()}] Line ${d.line}: ${d.message}${d.code ? ` (${d.code})` : ""}`,
    )
    .join("\n");
}

/**
 * 格式化风格提示为提示词
 */
export function formatStyleHintsForPrompt(hints: StyleHints): string {
  const parts: string[] = [];

  parts.push(`Indent: ${hints.indentSize} ${hints.indentStyle}`);
  parts.push(`Semicolons: ${hints.semicolon ? "yes" : "no"}`);
  parts.push(`Quotes: ${hints.quotes}`);
  if (hints.trailingComma) parts.push("Trailing commas: yes");
  if (hints.namingConvention) parts.push(`Naming: ${hints.namingConvention}`);

  return parts.join(", ");
}

/**
 * 格式化相关片段为提示词
 */
export function formatRelatedSnippetsForPrompt(snippets: RelatedSnippet[]): string {
  if (snippets.length === 0) return "(none)";

  return snippets.map((s) => `--- ${s.filePath} (${s.reason}) ---\n${s.content}`).join("\n\n");
}
