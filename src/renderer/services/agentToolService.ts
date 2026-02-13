/**
 * Agent Tool Service - 增强版工具执行引擎
 *
 * 超越 Cursor 的核心差异化:
 * 1. 安全检查 - isToolCallBlocked 权限验证
 * 2. 检查点 - 写入前自动备份，失败可回滚
 * 3. 结果截断 - 防止大结果溢出 AI 上下文窗口
 * 4. 审计日志 - 所有工具调用可追溯
 * 5. 智能重试 - 临时失败自动重试
 */

import { isToolCallBlocked, toolPermissions } from "../../core/ai/tools/schemas";
import { getLSPClient } from "../../core/lsp/client";
import type { DocumentSymbol, CompletionItem, Hover, Location } from "../../core/lsp/types";

// ==================== Types ====================

export interface ToolResult {
  success: boolean;
  data?: any;
  error?: string;
}

export interface ToolCallRecord {
  id: string;
  tool: string;
  args: Record<string, any>;
  result: ToolResult;
  duration: number;
  timestamp: number;
  checkpointId?: string;
}

export interface CheckpointEntry {
  id: string;
  filePath: string;
  originalContent: string;
  timestamp: number;
}

// ==================== Constants ====================

const MAX_RESULT_SIZE = 15000; // 工具结果最大字符数
const MAX_FILE_LINES_INLINE = 500; // 内联返回最大行数
const MAX_FILE_SIZE_INLINE = 50000; // 内联返回最大字节数
const MAX_SEARCH_RESULTS = 30; // 搜索最大结果数
const MAX_RETRY_COUNT = 2; // 最大重试次数

// ==================== Service ====================

export class AgentToolService {
  private workspaceRoot: string | null = null;
  private checkpoints: Map<string, CheckpointEntry> = new Map();
  private auditLog: ToolCallRecord[] = [];
  private getActiveFile: (() => { path: string; content: string } | null) | null = null;

  /** 更新上下文 */
  setContext(opts: {
    workspaceRoot: string | null;
    getActiveFile?: () => { path: string; content: string } | null;
  }) {
    this.workspaceRoot = opts.workspaceRoot;
    if (opts.getActiveFile) this.getActiveFile = opts.getActiveFile;
  }

  /** 主执行入口 */
  async execute(name: string, args: Record<string, any>): Promise<ToolResult> {
    const startTime = Date.now();

    // 1. 安全检查
    const blockCheck = isToolCallBlocked(name, args);
    if (blockCheck.blocked) {
      return this.logAndReturn(name, args, startTime, {
        success: false,
        error: `[安全] ${blockCheck.reason}`,
      });
    }

    // 2. 检查点（写入操作前备份）
    let checkpointId: string | undefined;
    if (name === "workspace_writeFile" && args.path) {
      checkpointId = await this.createCheckpoint(args.path);
    }

    // 3. 执行工具（带重试）
    let result: ToolResult;
    let attempts = 0;
    while (attempts <= MAX_RETRY_COUNT) {
      try {
        result = await this.executeHandler(name, args);
        break;
      } catch (e: any) {
        attempts++;
        if (attempts > MAX_RETRY_COUNT) {
          result = { success: false, error: `执行失败 (${attempts} 次尝试): ${e.message}` };
          break;
        }
        // 只对临时错误重试
        if (!this.isRetryable(e)) {
          result = { success: false, error: e.message };
          break;
        }
        await this.delay(500 * attempts); // 指数退避
      }
    }

    // 4. 截断大结果
    result = this.truncateResult(result!);

    // 5. 审计日志
    return this.logAndReturn(name, args, startTime, result, checkpointId);
  }

  /** 回滚到检查点 */
  async rollback(checkpointId: string): Promise<ToolResult> {
    const checkpoint = this.checkpoints.get(checkpointId);
    if (!checkpoint) {
      return { success: false, error: `检查点不存在: ${checkpointId}` };
    }

    try {
      const result = await window.mindcode?.fs?.writeFile?.(
        checkpoint.filePath,
        checkpoint.originalContent,
      );
      if (result?.success) {
        this.checkpoints.delete(checkpointId);
        return { success: true, data: { rolledBack: checkpoint.filePath } };
      }
      return { success: false, error: "回滚写入失败" };
    } catch (e: any) {
      return { success: false, error: `回滚失败: ${e.message}` };
    }
  }

  /** 回滚所有未确认的检查点 */
  async rollbackAll(): Promise<ToolResult[]> {
    const results: ToolResult[] = [];
    for (const [id] of this.checkpoints) {
      results.push(await this.rollback(id));
    }
    return results;
  }

  /** 确认检查点（清除备份） */
  confirmCheckpoint(checkpointId: string): void {
    this.checkpoints.delete(checkpointId);
  }

  /** 获取审计日志 */
  getAuditLog(): ToolCallRecord[] {
    return [...this.auditLog];
  }

  /** 清空审计日志 */
  clearAuditLog(): void {
    this.auditLog = [];
  }

  /** 获取检查点列表 */
  getCheckpoints(): CheckpointEntry[] {
    return Array.from(this.checkpoints.values());
  }

  // ==================== Private Methods ====================

  private resolvePath(p: string): string {
    if (!p) return this.workspaceRoot || "";
    if (p.match(/^[a-zA-Z]:[/\\]/) || p.startsWith("/")) return p;
    return this.workspaceRoot ? `${this.workspaceRoot}/${p}`.replace(/\\/g, "/") : p;
  }

  private async createCheckpoint(path: string): Promise<string | undefined> {
    try {
      const fullPath = this.resolvePath(path);
      const existing = await window.mindcode?.fs?.readFile?.(fullPath);
      if (existing?.success && existing.data !== undefined) {
        const id = `cp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        this.checkpoints.set(id, {
          id,
          filePath: fullPath,
          originalContent: existing.data,
          timestamp: Date.now(),
        });
        return id;
      }
    } catch {
      // 新文件，无需检查点
    }
    return undefined;
  }

  private async executeHandler(name: string, args: Record<string, any>): Promise<ToolResult> {
    switch (name) {
      case "workspace_listDir":
        return (
          (await window.mindcode?.fs?.readDir?.(this.resolvePath(args.path))) || {
            success: false,
            error: "API 不可用",
          }
        );

      case "workspace_readFile":
        return await this.handleReadFile(args);

      case "workspace_writeFile":
        return (
          (await window.mindcode?.fs?.writeFile?.(this.resolvePath(args.path), args.content)) || {
            success: false,
            error: "写入失败",
          }
        );

      case "workspace_search":
        return await this.handleSearch(args);

      case "codebase_semantic":
        return await this.handleSemanticSearch(args);

      case "editor_getActiveFile": {
        const f = this.getActiveFile?.();
        return { success: true, data: f ? { path: f.path, content: f.content } : null };
      }

      case "editor_getSelection": {
        const sel = window.getSelection?.()?.toString() || "";
        return { success: true, data: { text: sel } };
      }

      case "terminal_execute":
        return (
          (await window.mindcode?.terminal?.execute?.(
            args.command,
            args.cwd ? this.resolvePath(args.cwd) : this.workspaceRoot || undefined,
          )) || { success: false, error: "终端不可用" }
        );

      case "diagnostics_getLogs":
        return { success: true, data: { logs: "暂无日志", hint: "日志服务开发中" } };

      case "git_status":
        return (
          (await window.mindcode?.git?.status?.(this.workspaceRoot || "")) || {
            success: false,
            error: "Git 不可用",
          }
        );

      case "git_diff":
        return (
          (await window.mindcode?.git?.diff?.(
            this.workspaceRoot || "",
            args.path,
            args.staged,
          )) || { success: false, error: "Git 不可用" }
        );

      // ==================== LSP 工具 ====================

      case "lsp_hover":
        return await this.handleLSPHover(args);

      case "lsp_definition":
        return await this.handleLSPDefinition(args);

      case "lsp_references":
        return await this.handleLSPReferences(args);

      case "lsp_symbols":
        return await this.handleLSPSymbols(args);

      case "lsp_diagnostics":
        return await this.handleLSPDiagnostics(args);

      case "lsp_completions":
        return await this.handleLSPCompletions(args);

      default:
        return { success: false, error: `未知工具: ${name}` };
    }
  }

  /** 智能文件读取 - 大文件返回摘要 */
  private async handleReadFile(args: Record<string, any>): Promise<ToolResult> {
    const fullPath = this.resolvePath(args.path);
    const res = await window.mindcode?.fs?.readFile?.(fullPath);
    if (!res?.success) return res || { success: false, error: "读取失败" };

    let content = res.data || "";
    const lines = content.split("\n");
    const totalLines = lines.length;

    // 行范围截取
    if (args.startLine || args.endLine) {
      const start = Math.max(0, (args.startLine || 1) - 1);
      const end = Math.min(totalLines, args.endLine || totalLines);
      content = lines.slice(start, end).join("\n");
      return { success: true, data: { content, startLine: start + 1, endLine: end, totalLines } };
    }

    // 大文件：返回结构摘要 + 首尾
    if (content.length > MAX_FILE_SIZE_INLINE || totalLines > MAX_FILE_LINES_INLINE) {
      const summary = this.generateFileSummary(fullPath, lines);
      return {
        success: true,
        data: {
          summary,
          totalLines,
          totalChars: content.length,
          hint: `文件过大 (${totalLines} 行)。使用 startLine/endLine 读取特定部分。`,
        },
      };
    }

    return { success: true, data: { content, totalLines } };
  }

  /** 搜索 - 限制结果数量 */
  private async handleSearch(args: Record<string, any>): Promise<ToolResult> {
    const searchParams: any = {
      workspacePath: this.workspaceRoot || "",
      query: args.query,
      maxResults: Math.min(args.maxResults || MAX_SEARCH_RESULTS, MAX_SEARCH_RESULTS),
    };
    if (args.glob) searchParams.glob = args.glob;
    const result = await window.mindcode?.fs?.searchInFiles?.(searchParams);
    return result || { success: false, error: "搜索失败" };
  }

  /** 语义搜索 */
  private async handleSemanticSearch(args: Record<string, any>): Promise<ToolResult> {
    try {
      const results = await window.mindcode?.index?.getRelatedCode?.(args.query, args.topK || 5);
      if (!results?.success) {
        return { success: false, error: "语义搜索失败。代码索引可能未构建，请先打开工作区。" };
      }
      return { success: true, data: results.data };
    } catch {
      return { success: false, error: "语义搜索服务不可用" };
    }
  }

  // ==================== LSP Handlers ====================

  /** 解析文件路径 → LSP 语言 + URI */
  private resolveFileForLSP(filePath: string): { language: string; uri: string } | null {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      py: "python",
      rs: "rust",
      go: "go",
      c: "c",
      cpp: "cpp",
      h: "c",
      hpp: "cpp",
    };
    const language = langMap[ext];
    if (!language) return null;
    const resolved = this.resolvePath(filePath);
    const uri = `file:///${resolved.replace(/\\/g, "/")}`;
    return { language, uri };
  }

  /** LSP Hover — 获取符号类型信息 */
  private async handleLSPHover(args: Record<string, any>): Promise<ToolResult> {
    const info = this.resolveFileForLSP(args.path);
    if (!info) return { success: false, error: "不支持的文件类型" };
    const client = getLSPClient(info.language);
    if (!client || client.getState() !== "running")
      return { success: false, error: `LSP 未运行: ${info.language}` };
    try {
      const hover = await client.getHover(info.uri, {
        line: (args.line || 1) - 1,
        character: (args.column || 1) - 1,
      });
      if (!hover) return { success: true, data: null };
      const contents = typeof hover.contents === "string" ? hover.contents : hover.contents.value;
      return { success: true, data: { contents, range: hover.range } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** LSP Definition — 跳转定义 */
  private async handleLSPDefinition(args: Record<string, any>): Promise<ToolResult> {
    const info = this.resolveFileForLSP(args.path);
    if (!info) return { success: false, error: "不支持的文件类型" };
    const client = getLSPClient(info.language);
    if (!client || client.getState() !== "running")
      return { success: false, error: `LSP 未运行: ${info.language}` };
    try {
      const result = await client.getDefinition(info.uri, {
        line: (args.line || 1) - 1,
        character: (args.column || 1) - 1,
      });
      if (!result) return { success: true, data: null };
      const locations = Array.isArray(result) ? result : [result];
      return {
        success: true,
        data: locations.map((l) => ({
          uri: l.uri,
          line: l.range.start.line + 1,
          column: l.range.start.character + 1,
        })),
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** LSP References — 查找引用 */
  private async handleLSPReferences(args: Record<string, any>): Promise<ToolResult> {
    const info = this.resolveFileForLSP(args.path);
    if (!info) return { success: false, error: "不支持的文件类型" };
    const client = getLSPClient(info.language);
    if (!client || client.getState() !== "running")
      return { success: false, error: `LSP 未运行: ${info.language}` };
    try {
      const refs = await client.getReferences(info.uri, {
        line: (args.line || 1) - 1,
        character: (args.column || 1) - 1,
      });
      return {
        success: true,
        data: refs.map((r) => ({
          uri: r.uri,
          line: r.range.start.line + 1,
          column: r.range.start.character + 1,
        })),
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** LSP Symbols — 文档符号列表 */
  private async handleLSPSymbols(args: Record<string, any>): Promise<ToolResult> {
    const info = this.resolveFileForLSP(args.path);
    if (!info) return { success: false, error: "不支持的文件类型" };
    const client = getLSPClient(info.language);
    if (!client || client.getState() !== "running")
      return { success: false, error: `LSP 未运行: ${info.language}` };
    try {
      const symbols = await client.getDocumentSymbols(info.uri);
      const flatten = (syms: DocumentSymbol[], depth = 0): any[] =>
        syms.flatMap((s) => [
          { name: s.name, kind: s.kind, line: s.range.start.line + 1, depth },
          ...(s.children ? flatten(s.children, depth + 1) : []),
        ]);
      return { success: true, data: flatten(symbols) };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** LSP Diagnostics — 获取文件诊断 */
  private async handleLSPDiagnostics(args: Record<string, any>): Promise<ToolResult> {
    const info = this.resolveFileForLSP(args.path);
    if (!info) return { success: false, error: "不支持的文件类型" };
    const client = getLSPClient(info.language);
    if (!client || client.getState() !== "running")
      return { success: false, error: `LSP 未运行: ${info.language}` };
    try {
      const diags = await client.getDiagnostics(info.uri);
      const severityMap: Record<number, string> = {
        1: "error",
        2: "warning",
        3: "info",
        4: "hint",
      };
      return {
        success: true,
        data: diags.map((d) => ({
          message: d.message,
          severity: severityMap[d.severity || 4] || "hint",
          line: d.range.start.line + 1,
          column: d.range.start.character + 1,
          code: d.code,
          source: d.source,
        })),
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** LSP Completions — 获取补全建议 */
  private async handleLSPCompletions(args: Record<string, any>): Promise<ToolResult> {
    const info = this.resolveFileForLSP(args.path);
    if (!info) return { success: false, error: "不支持的文件类型" };
    const client = getLSPClient(info.language);
    if (!client || client.getState() !== "running")
      return { success: false, error: `LSP 未运行: ${info.language}` };
    try {
      const items = await client.getCompletion(info.uri, {
        line: (args.line || 1) - 1,
        character: (args.column || 1) - 1,
      });
      return {
        success: true,
        data: items.slice(0, args.maxItems || 20).map((i) => ({
          label: i.label,
          kind: i.kind,
          detail: i.detail,
          insertText: i.insertText,
        })),
      };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /** 生成文件结构摘要 */
  private generateFileSummary(path: string, lines: string[]): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    let summary = `文件: ${path.split(/[/\\]/).pop()} (${lines.length} 行)\n\n`;

    // 提取代码结构
    const codeExts = ["ts", "tsx", "js", "jsx", "py", "java", "go", "rs", "c", "cpp", "cs"];
    if (codeExts.includes(ext)) {
      const structures: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (
          t.match(
            /^(export\s+)?(default\s+)?(class|interface|type|enum|function|const|async\s+function|abstract\s+class)\s+\w+/,
          )
        ) {
          structures.push(`L${i + 1}: ${t.slice(0, 100)}`);
        }
      }
      if (structures.length) {
        summary += `[结构 (${structures.length} 个定义)]\n${structures.slice(0, 40).join("\n")}\n\n`;
      }
    }

    // 首尾内容
    const headLines = Math.min(40, lines.length);
    const tailLines = Math.min(15, Math.max(0, lines.length - headLines));
    summary += `[开头 ${headLines} 行]\n${lines.slice(0, headLines).join("\n")}`;
    if (tailLines > 0) {
      summary += `\n\n... (省略 ${lines.length - headLines - tailLines} 行) ...\n\n[结尾 ${tailLines} 行]\n${lines.slice(-tailLines).join("\n")}`;
    }

    return summary;
  }

  /** 截断过大的工具结果 */
  private truncateResult(result: ToolResult): ToolResult {
    if (!result.success || !result.data) return result;

    const serialized = typeof result.data === "string" ? result.data : JSON.stringify(result.data);

    if (serialized.length <= MAX_RESULT_SIZE) return result;

    // 截断并添加提示
    const truncated = serialized.slice(0, MAX_RESULT_SIZE);
    return {
      success: true,
      data:
        typeof result.data === "string"
          ? truncated + `\n\n[结果已截断，原始长度 ${serialized.length} 字符。请使用更精确的查询。]`
          : { _truncated: true, _originalSize: serialized.length, preview: truncated },
    };
  }

  /** 判断错误是否可重试 */
  private isRetryable(error: any): boolean {
    const msg = error?.message?.toLowerCase() || "";
    return msg.includes("timeout") || msg.includes("network") || msg.includes("econnreset");
  }

  /** 记录审计日志并返回结果 */
  private logAndReturn(
    name: string,
    args: Record<string, any>,
    startTime: number,
    result: ToolResult,
    checkpointId?: string,
  ): ToolResult {
    const record: ToolCallRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tool: name,
      args,
      result,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
      checkpointId,
    };
    this.auditLog.push(record);

    // 保持审计日志在合理范围
    if (this.auditLog.length > 200) {
      this.auditLog = this.auditLog.slice(-100);
    }

    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// 单例
export const agentToolService = new AgentToolService();
