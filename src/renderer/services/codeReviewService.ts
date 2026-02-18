/**
 * Code Review Service (Renderer)
 *
 * 独家功能：Git 提交前 AI 智能代码审查
 * Cursor 没有这个功能 — 这是 MindCode 的核心差异化
 *
 * 功能：
 * 1. 获取暂存文件的 diff
 * 2. 规则引擎检测（安全/性能/风格）
 * 3. AI 深度分析（上下文理解）
 * 4. 一键修复
 */

// ==================== Types ====================

export type IssueSeverity = "error" | "warning" | "info";
export type IssueCategory = "security" | "performance" | "style" | "bug" | "best-practice";

export interface ReviewIssue {
  id: string;
  filePath: string;
  line: number;
  endLine?: number;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  code?: string; // 问题代码片段
  suggestion?: string; // 修复建议代码
  fixable: boolean; // 是否可一键修复
}

export interface ReviewResult {
  issues: ReviewIssue[];
  summary: {
    totalFiles: number;
    totalIssues: number;
    errors: number;
    warnings: number;
    infos: number;
  };
  duration: number;
}

// ==================== Rule-based checks ====================

interface RuleCheck {
  id: string;
  pattern: RegExp;
  severity: IssueSeverity;
  category: IssueCategory;
  title: string;
  description: string;
  fixable: boolean;
  fix?: (match: string) => string;
}

const RULES: RuleCheck[] = [
  // Security
  {
    id: "sec-eval",
    pattern: /\beval\s*\(/g,
    severity: "error",
    category: "security",
    title: "危险的 eval() 调用",
    description: "eval() 可执行任意代码，存在代码注入风险。使用 JSON.parse() 或其他安全替代方案。",
    fixable: false,
  },
  {
    id: "sec-innerhtml",
    pattern: /\.innerHTML\s*=/g,
    severity: "warning",
    category: "security",
    title: "innerHTML 赋值存在 XSS 风险",
    description: "直接设置 innerHTML 可能导致跨站脚本攻击。使用 textContent 或 DOM API。",
    fixable: false,
  },
  {
    id: "sec-hardcoded-secret",
    pattern: /(password|secret|api_?key|token|private_?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi,
    severity: "error",
    category: "security",
    title: "硬编码的敏感信息",
    description: "密码/密钥不应硬编码在源代码中。使用环境变量或密钥管理服务。",
    fixable: false,
  },
  {
    id: "sec-sql-injection",
    pattern: /`[^`]*\$\{[^}]+\}[^`]*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER)[^`]*`/gi,
    severity: "error",
    category: "security",
    title: "SQL 注入风险",
    description: "字符串拼接 SQL 语句存在注入风险。使用参数化查询。",
    fixable: false,
  },
  // Performance
  {
    id: "perf-json-clone",
    pattern: /JSON\.parse\s*\(\s*JSON\.stringify/g,
    severity: "warning",
    category: "performance",
    title: "低效的深拷贝",
    description:
      "JSON.parse(JSON.stringify()) 性能差且不支持特殊类型。使用 structuredClone() 或 lodash.cloneDeep()。",
    fixable: false,
  },
  {
    id: "perf-await-forEach",
    pattern: /\.forEach\s*\(\s*async/g,
    severity: "warning",
    category: "performance",
    title: "forEach 中使用 async",
    description: "forEach 不会等待 async 回调完成。使用 for...of 循环或 Promise.all(map(...))。",
    fixable: false,
  },
  {
    id: "perf-console",
    pattern: /console\.(log|debug|info|warn)\s*\(/g,
    severity: "info",
    category: "performance",
    title: "残留的 console 输出",
    description: "生产代码中应移除调试用的 console 语句。",
    fixable: true,
    fix: (match) => `// ${match.trim()}`,
  },
  // Style / Best Practice
  {
    id: "style-var",
    pattern: /\bvar\s+\w/g,
    severity: "warning",
    category: "style",
    title: "使用了 var 声明",
    description: "使用 const 或 let 替代 var，避免变量提升带来的问题。",
    fixable: true,
    fix: (match) => match.replace("var", "const"),
  },
  {
    id: "style-loose-equal",
    pattern: /[^!=]==[^=]/g,
    severity: "info",
    category: "style",
    title: "使用了宽松相等 (==)",
    description: "使用严格相等 (===) 避免类型隐式转换。",
    fixable: true,
    fix: (match) => match.replace("==", "==="),
  },
  {
    id: "bug-todo",
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX|BUG)[:.\s]/gi,
    severity: "info",
    category: "best-practice",
    title: "待处理标记",
    description: "发现待处理的代码标记，提交前请确认是否已处理。",
    fixable: false,
  },
  {
    id: "style-any-type",
    pattern: /:\s*any\b/g,
    severity: "info",
    category: "style",
    title: "使用了 any 类型",
    description: "TypeScript 代码应尽量避免使用 any，使用具体类型以获得类型安全。",
    fixable: false,
  },
];

// ==================== Service ====================

/**
 * 对暂存文件执行 AI 代码审查
 */
export async function reviewStagedFiles(workspacePath: string): Promise<ReviewResult> {
  const startTime = Date.now();
  const issues: ReviewIssue[] = [];

  // 1. 获取暂存文件列表
  const statusResult = await window.mindcode?.git?.status?.(workspacePath);
  if (!statusResult?.success || !statusResult.data) {
    return emptyResult(startTime);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData = statusResult.data as any;
  const fileList = Array.isArray(rawData) ? rawData : rawData?.files || [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stagedFiles = fileList.filter((f: any) => f.staged);
  if (stagedFiles.length === 0) {
    return emptyResult(startTime);
  }

  // 2. 对每个暂存文件获取 diff 并审查
  for (const file of stagedFiles) {
    if (file.status === "deleted") continue;

    // 只审查代码文件
    const ext = file.path.split(".").pop()?.toLowerCase() || "";
    const codeExts = [
      "ts",
      "tsx",
      "js",
      "jsx",
      "py",
      "java",
      "go",
      "rs",
      "c",
      "cpp",
      "cs",
      "rb",
      "php",
    ];
    if (!codeExts.includes(ext)) continue;

    try {
      // 获取文件 diff
      const diffResult = await window.mindcode?.git?.diff?.(workspacePath, file.path, true);
      const diff = diffResult?.success ? diffResult.data : "";

      // 获取完整文件内容
      const fullPath = `${workspacePath}/${file.path}`.replace(/\\/g, "/");
      const fileResult = await window.mindcode?.fs?.readFile?.(fullPath);
      const content = fileResult?.success ? fileResult.data : "";

      if (!content) continue;

      // 提取变更的行号（只审查变更的部分）
      const changedLines = extractChangedLines(diff || "");

      // 规则引擎审查
      const ruleIssues = runRuleChecks(file.path, content, changedLines);
      issues.push(...ruleIssues);
    } catch (e) {
      console.warn(`[Review] 审查文件失败: ${file.path}`, e);
    }
  }

  // 3. 汇总结果
  const result: ReviewResult = {
    issues: issues.sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity)),
    summary: {
      totalFiles: stagedFiles.length,
      totalIssues: issues.length,
      errors: issues.filter((i) => i.severity === "error").length,
      warnings: issues.filter((i) => i.severity === "warning").length,
      infos: issues.filter((i) => i.severity === "info").length,
    },
    duration: Date.now() - startTime,
  };

  return result;
}

/**
 * 一键修复某个问题
 */
export async function fixIssue(
  workspacePath: string,
  issue: ReviewIssue,
): Promise<{ success: boolean; error?: string }> {
  if (!issue.fixable || !issue.suggestion) {
    return { success: false, error: "该问题不支持自动修复" };
  }

  const fullPath = `${workspacePath}/${issue.filePath}`.replace(/\\/g, "/");

  try {
    const fileResult = await window.mindcode?.fs?.readFile?.(fullPath);
    if (!fileResult?.success) return { success: false, error: "读取文件失败" };

    const content = fileResult.data as string;
    if (!content) return { success: false, error: "文件内容为空" };
    const lines = content.split("\n");
    if (issue.line > 0 && issue.line <= lines.length) {
      // 简单替换 — 用建议代码替换问题行
      lines[issue.line - 1] = issue.suggestion!;
      const newContent = lines.join("\n");

      const writeResult = await window.mindcode?.fs?.writeFile?.(fullPath, newContent);
      if (writeResult?.success) {
        // 重新暂存修复后的文件
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (window.mindcode?.git?.stage as any)?.(workspacePath, issue.filePath);
        return { success: true };
      }
    }
    return { success: false, error: "修复应用失败" };
  } catch (e: unknown) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ==================== Helpers ====================

function emptyResult(startTime: number): ReviewResult {
  return {
    issues: [],
    summary: { totalFiles: 0, totalIssues: 0, errors: 0, warnings: 0, infos: 0 },
    duration: Date.now() - startTime,
  };
}

function severityOrder(s: IssueSeverity): number {
  return s === "error" ? 0 : s === "warning" ? 1 : 2;
}

/** 从 git diff 提取变更行号 */
function extractChangedLines(diff: string): Set<number> {
  const changed = new Set<number>();
  if (!diff) return changed;

  const hunkPattern = /@@\s*-\d+(?:,\d+)?\s+\+(\d+)(?:,(\d+))?\s*@@/g;
  let match;
  while ((match = hunkPattern.exec(diff)) !== null) {
    const start = parseInt(match[1], 10);
    const count = parseInt(match[2] || "1", 10);
    for (let i = start; i < start + count; i++) {
      changed.add(i);
    }
  }
  return changed;
}

/** 规则引擎审查 */
function runRuleChecks(
  filePath: string,
  content: string,
  changedLines: Set<number>,
): ReviewIssue[] {
  const issues: ReviewIssue[] = [];
  const lines = content.split("\n");
  const onlyChangedLines = changedLines.size > 0;

  for (const rule of RULES) {
    // 逐行匹配
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;

      // 如果有变更行信息，只审查变更的行
      if (onlyChangedLines && !changedLines.has(lineNum)) continue;

      const line = lines[i];
      rule.pattern.lastIndex = 0; // 重置 regex

      if (rule.pattern.test(line)) {
        rule.pattern.lastIndex = 0;
        const matchResult = rule.pattern.exec(line);
        const matchedText = matchResult?.[0] || "";

        issues.push({
          id: `${rule.id}_${filePath}_${lineNum}`,
          filePath,
          line: lineNum,
          severity: rule.severity,
          category: rule.category,
          title: rule.title,
          description: rule.description,
          code: line.trim(),
          suggestion: rule.fixable && rule.fix ? rule.fix(line) : undefined,
          fixable: rule.fixable,
        });
      }
    }
  }

  return issues;
}
