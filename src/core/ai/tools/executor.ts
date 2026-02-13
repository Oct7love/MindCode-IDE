// AI 工具执行器
import type { ToolCall, ToolResult } from "./schemas";
import { toolPermissions } from "./schemas";

/** MindCode 全局 API（渲染进程） */
interface MindCodeGlobal {
  mindcode?: {
    fs?: {
      readDir?: (path: string) => Promise<unknown>;
      readFile?: (path: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      writeFile?: (path: string, content: string) => Promise<unknown>;
      searchInFiles?: (params: {
        workspacePath: string;
        query: string;
        maxResults: number;
      }) => Promise<unknown>;
    };
    terminal?: {
      execute?: (command: string, cwd?: string | null) => Promise<unknown>;
    };
    git?: {
      status?: (root: string) => Promise<unknown>;
      diff?: (root: string, path?: string, staged?: boolean) => Promise<unknown>;
    };
  };
}
const _win = (typeof window !== "undefined" ? window : null) as (Window & MindCodeGlobal) | null;

export interface ToolContext {
  workspaceRoot: string | null;
  activeFile?: { path: string; content: string } | null;
  onConfirm?: (tool: string, args: unknown) => Promise<boolean>;
}

export class ToolExecutor {
  private context: ToolContext;
  private handlers: Map<
    string,
    (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>
  > = new Map();

  constructor(context: ToolContext) {
    this.context = context;
    this.registerBuiltinHandlers();
  }

  private registerBuiltinHandlers() {
    // 注册内置工具处理器（通过 IPC 调用主进程）
    this.handlers.set("workspace.listDir", async (args) => {
      const fullPath = this.resolvePath(args.path);
      return await _win?.mindcode?.fs?.readDir?.(fullPath);
    });
    this.handlers.set("workspace.readFile", async (args) => {
      const fullPath = this.resolvePath(args.path);
      const res = await _win?.mindcode?.fs?.readFile?.(fullPath);
      if (!res?.success) return { success: false, error: res?.error || "读取失败" };
      let content = res.data || "";
      const lines = content.split("\n"),
        totalLines = lines.length;
      if (args.startLine || args.endLine) {
        // 截取行范围
        const start = ((args.startLine as number) || 1) - 1,
          end = (args.endLine as number) || totalLines;
        content = lines.slice(start, end).join("\n");
        return { success: true, data: { content, startLine: start + 1, endLine: end, totalLines } };
      }
      if (content.length > 50000 || totalLines > 500) {
        // 超长文件：返回摘要
        const summary = this.generateSummary(fullPath, lines);
        return {
          success: true,
          data: {
            summary,
            totalLines,
            totalChars: content.length,
            hint: "文件过大，已返回摘要。使用 startLine/endLine 参数读取特定部分。",
          },
        };
      }
      return { success: true, data: { content, totalLines } };
    });
    this.handlers.set("workspace.writeFile", async (args) => {
      const fullPath = this.resolvePath(args.path);
      return await _win?.mindcode?.fs?.writeFile?.(fullPath, String(args.content));
    });
    this.handlers.set("workspace.search", async (args) => {
      if (!this.context.workspaceRoot) return { success: false, error: "未打开工作区" };
      return await _win?.mindcode?.fs?.searchInFiles?.({
        workspacePath: this.context.workspaceRoot,
        query: String(args.query),
        maxResults: (args.maxResults as number) || 50,
      });
    });
    this.handlers.set("editor.getActiveFile", async () => {
      if (!this.context.activeFile) return { success: true, data: null };
      return { success: true, data: this.context.activeFile };
    });
    this.handlers.set("editor.getSelection", async () => {
      const sel = window.getSelection?.()?.toString() || "";
      return { success: true, data: { text: sel, file: this.context.activeFile?.path } };
    });
    this.handlers.set("terminal.execute", async (args) => {
      const cwd = args.cwd ? this.resolvePath(args.cwd) : this.context.workspaceRoot;
      return await _win?.mindcode?.terminal?.execute?.(String(args.command), cwd);
    });
    this.handlers.set("diagnostics.getLogs", async (args) => {
      return {
        success: true,
        data: {
          logs: `[模拟日志] 最近 ${(args.lines as number) || 100} 行`,
          timestamp: new Date().toISOString(),
        },
      };
    });
    this.handlers.set("git.status", async () => {
      if (!this.context.workspaceRoot) return { success: false, error: "未打开工作区" };
      return await _win?.mindcode?.git?.status?.(this.context.workspaceRoot);
    });
    this.handlers.set("git.diff", async (args) => {
      if (!this.context.workspaceRoot) return { success: false, error: "未打开工作区" };
      return await _win?.mindcode?.git?.diff?.(
        this.context.workspaceRoot,
        args.path as string | undefined,
        args.staged as boolean | undefined,
      );
    });
  }

  private resolvePath(p: unknown): string {
    // 解析路径
    const s = typeof p === "string" ? p : "";
    if (!s) return this.context.workspaceRoot || "";
    if (s.match(/^[a-zA-Z]:[/\\]/) || s.startsWith("/")) return s; // 绝对路径
    return this.context.workspaceRoot
      ? `${this.context.workspaceRoot}/${s}`.replace(/\\/g, "/")
      : s;
  }

  private generateSummary(path: string, lines: string[]): string {
    // 生成超长文件摘要
    const ext = path.split(".").pop()?.toLowerCase() || "";
    let summary = `文件: ${path} (${lines.length} 行)\n\n`;
    const codeExts = ["ts", "tsx", "js", "jsx", "py", "java", "go", "rs", "c", "cpp"];
    if (codeExts.includes(ext)) {
      // 提取代码结构
      const structs: string[] = [];
      lines.forEach((line, i) => {
        const t = line.trim();
        if (t.match(/^(export\s+)?(class|interface|type|enum|function|const|async function)\s+\w+/))
          structs.push(`L${i + 1}: ${t.slice(0, 80)}`);
      });
      if (structs.length) summary += `【结构】\n${structs.slice(0, 30).join("\n")}\n\n`;
    }
    summary += `【开头 50 行】\n${lines.slice(0, 50).join("\n")}\n\n【结尾 20 行】\n${lines.slice(-20).join("\n")}`;
    return summary;
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    // 执行工具调用
    const handler = this.handlers.get(call.name);
    if (!handler)
      return { id: call.id, name: call.name, success: false, error: `未知工具: ${call.name}` };
    const perm = toolPermissions[call.name];
    if (perm?.requireConfirmation && this.context.onConfirm) {
      // 需要确认
      const confirmed = await this.context.onConfirm(call.name, call.arguments);
      if (!confirmed)
        return { id: call.id, name: call.name, success: false, error: "用户取消操作" };
    }
    try {
      const raw = await handler(call.arguments, this.context);
      const result = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        id: call.id,
        name: call.name,
        success: result.success !== false,
        data: result.data ?? raw,
        error: result.error as string | undefined,
      };
    } catch (e: unknown) {
      return {
        id: call.id,
        name: call.name,
        success: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  async executeMultiple(calls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(calls.map((c) => this.execute(c)));
  } // 批量执行

  updateContext(ctx: Partial<ToolContext>) {
    Object.assign(this.context, ctx);
  } // 更新上下文
}

export function parseToolCalls(
  response: Record<string, unknown>,
  provider: "claude" | "openai" | "gemini",
): ToolCall[] {
  // 解析 Provider 返回的工具调用
  const calls: ToolCall[] = [];
  if (provider === "claude" && Array.isArray(response.content)) {
    response.content
      .filter((b: Record<string, unknown>) => b.type === "tool_use")
      .forEach((b: Record<string, unknown>) =>
        calls.push({
          id: b.id as string,
          name: b.name as string,
          arguments: (b.input as Record<string, unknown>) || {},
        }),
      );
  } else {
    const resp = response as Record<string, unknown>;
    if (provider === "openai") {
      const choices = resp.choices as Array<Record<string, unknown>> | undefined;
      const msg = choices?.[0]?.message as Record<string, unknown> | undefined;
      const toolCalls = msg?.tool_calls as Array<Record<string, unknown>> | undefined;
      toolCalls?.forEach((tc: Record<string, unknown>) => {
        try {
          const fn = tc.function as Record<string, unknown>;
          calls.push({
            id: tc.id as string,
            name: fn.name as string,
            arguments: JSON.parse((fn.arguments as string) || "{}"),
          });
        } catch {
          /* 忽略解析失败 */
        }
      });
    } else if (provider === "gemini") {
      const candidates = resp.candidates as Array<Record<string, unknown>> | undefined;
      const parts = (candidates?.[0]?.content as Record<string, unknown>)?.parts as
        | Array<Record<string, unknown>>
        | undefined;
      parts
        ?.filter((p: Record<string, unknown>) => p.functionCall)
        .forEach((p: Record<string, unknown>, i: number) => {
          const fc = p.functionCall as Record<string, unknown>;
          calls.push({
            id: `gemini-${i}`,
            name: fc.name as string,
            arguments: (fc.args as Record<string, unknown>) || {},
          });
        });
    }
  }
  return calls;
}

export function formatToolResults(
  results: ToolResult[],
  provider: "claude" | "openai" | "gemini",
): unknown {
  // 格式化工具结果给 Provider
  if (provider === "claude")
    return results.map((r) => ({
      type: "tool_result",
      tool_use_id: r.id,
      content: JSON.stringify(r.success ? r.data : { error: r.error }),
    }));
  if (provider === "openai")
    return results.map((r) => ({
      role: "tool",
      tool_call_id: r.id,
      content: JSON.stringify(r.success ? r.data : { error: r.error }),
    }));
  if (provider === "gemini")
    return {
      parts: results.map((r) => ({
        functionResponse: { name: r.name, response: r.success ? r.data : { error: r.error } },
      })),
    };
  return results;
}
