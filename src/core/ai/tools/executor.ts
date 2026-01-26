// AI 工具执行器
import { ToolCall, ToolResult, toolPermissions } from './schemas';

export interface ToolContext { workspaceRoot: string | null; activeFile?: { path: string; content: string } | null; onConfirm?: (tool: string, args: any) => Promise<boolean>; }

export class ToolExecutor {
  private context: ToolContext;
  private handlers: Map<string, (args: any, ctx: ToolContext) => Promise<any>> = new Map();

  constructor(context: ToolContext) { this.context = context; this.registerBuiltinHandlers(); }

  private registerBuiltinHandlers() { // 注册内置工具处理器（通过 IPC 调用主进程）
    this.handlers.set('workspace.listDir', async (args) => {
      const fullPath = this.resolvePath(args.path);
      return await (window as any).mindcode?.fs?.readDir?.(fullPath);
    });
    this.handlers.set('workspace.readFile', async (args) => {
      const fullPath = this.resolvePath(args.path);
      const res = await (window as any).mindcode?.fs?.readFile?.(fullPath);
      if (!res?.success) return { success: false, error: res?.error || '读取失败' };
      let content = res.data || '';
      const lines = content.split('\n'), totalLines = lines.length;
      if (args.startLine || args.endLine) { // 截取行范围
        const start = (args.startLine || 1) - 1, end = args.endLine || totalLines;
        content = lines.slice(start, end).join('\n');
        return { success: true, data: { content, startLine: start + 1, endLine: end, totalLines } };
      }
      if (content.length > 50000 || totalLines > 500) { // 超长文件：返回摘要
        const summary = this.generateSummary(fullPath, lines);
        return { success: true, data: { summary, totalLines, totalChars: content.length, hint: '文件过大，已返回摘要。使用 startLine/endLine 参数读取特定部分。' } };
      }
      return { success: true, data: { content, totalLines } };
    });
    this.handlers.set('workspace.writeFile', async (args) => {
      const fullPath = this.resolvePath(args.path);
      return await (window as any).mindcode?.fs?.writeFile?.(fullPath, args.content);
    });
    this.handlers.set('workspace.search', async (args) => {
      if (!this.context.workspaceRoot) return { success: false, error: '未打开工作区' };
      return await (window as any).mindcode?.fs?.searchInFiles?.({ workspacePath: this.context.workspaceRoot, query: args.query, maxResults: args.maxResults || 50 });
    });
    this.handlers.set('editor.getActiveFile', async () => {
      if (!this.context.activeFile) return { success: true, data: null };
      return { success: true, data: this.context.activeFile };
    });
    this.handlers.set('editor.getSelection', async () => {
      const sel = window.getSelection?.()?.toString() || '';
      return { success: true, data: { text: sel, file: this.context.activeFile?.path } };
    });
    this.handlers.set('terminal.execute', async (args) => {
      const cwd = args.cwd ? this.resolvePath(args.cwd) : this.context.workspaceRoot;
      return await (window as any).mindcode?.terminal?.execute?.(args.command, cwd);
    });
    this.handlers.set('diagnostics.getLogs', async (args) => {
      return { success: true, data: { logs: `[模拟日志] 最近 ${args.lines || 100} 行`, timestamp: new Date().toISOString() } };
    });
    this.handlers.set('git.status', async () => {
      if (!this.context.workspaceRoot) return { success: false, error: '未打开工作区' };
      return await (window as any).mindcode?.git?.status?.(this.context.workspaceRoot);
    });
    this.handlers.set('git.diff', async (args) => {
      if (!this.context.workspaceRoot) return { success: false, error: '未打开工作区' };
      return await (window as any).mindcode?.git?.diff?.(this.context.workspaceRoot, args.path, args.staged);
    });
  }

  private resolvePath(p: string): string { // 解析路径
    if (!p) return this.context.workspaceRoot || '';
    if (p.match(/^[a-zA-Z]:[/\\]/) || p.startsWith('/')) return p; // 绝对路径
    return this.context.workspaceRoot ? `${this.context.workspaceRoot}/${p}`.replace(/\\/g, '/') : p;
  }

  private generateSummary(path: string, lines: string[]): string { // 生成超长文件摘要
    const ext = path.split('.').pop()?.toLowerCase() || '';
    let summary = `文件: ${path} (${lines.length} 行)\n\n`;
    const codeExts = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'c', 'cpp'];
    if (codeExts.includes(ext)) { // 提取代码结构
      const structs: string[] = [];
      lines.forEach((line, i) => {
        const t = line.trim();
        if (t.match(/^(export\s+)?(class|interface|type|enum|function|const|async function)\s+\w+/)) structs.push(`L${i + 1}: ${t.slice(0, 80)}`);
      });
      if (structs.length) summary += `【结构】\n${structs.slice(0, 30).join('\n')}\n\n`;
    }
    summary += `【开头 50 行】\n${lines.slice(0, 50).join('\n')}\n\n【结尾 20 行】\n${lines.slice(-20).join('\n')}`;
    return summary;
  }

  async execute(call: ToolCall): Promise<ToolResult> { // 执行工具调用
    const handler = this.handlers.get(call.name);
    if (!handler) return { id: call.id, name: call.name, success: false, error: `未知工具: ${call.name}` };
    const perm = toolPermissions[call.name];
    if (perm?.requireConfirmation && this.context.onConfirm) { // 需要确认
      const confirmed = await this.context.onConfirm(call.name, call.arguments);
      if (!confirmed) return { id: call.id, name: call.name, success: false, error: '用户取消操作' };
    }
    try {
      const result = await handler(call.arguments, this.context);
      return { id: call.id, name: call.name, success: result?.success !== false, data: result?.data ?? result, error: result?.error };
    } catch (e: any) {
      return { id: call.id, name: call.name, success: false, error: e.message || '执行失败' };
    }
  }

  async executeMultiple(calls: ToolCall[]): Promise<ToolResult[]> { return Promise.all(calls.map(c => this.execute(c))); } // 批量执行

  updateContext(ctx: Partial<ToolContext>) { Object.assign(this.context, ctx); } // 更新上下文
}

export function parseToolCalls(response: any, provider: 'claude' | 'openai' | 'gemini'): ToolCall[] { // 解析 Provider 返回的工具调用
  const calls: ToolCall[] = [];
  if (provider === 'claude' && response.content) {
    response.content.filter((b: any) => b.type === 'tool_use').forEach((b: any) => calls.push({ id: b.id, name: b.name, arguments: b.input || {} }));
  } else if (provider === 'openai' && response.choices?.[0]?.message?.tool_calls) {
    response.choices[0].message.tool_calls.forEach((tc: any) => {
      try { calls.push({ id: tc.id, name: tc.function.name, arguments: JSON.parse(tc.function.arguments || '{}') }); } catch {}
    });
  } else if (provider === 'gemini' && response.candidates?.[0]?.content?.parts) {
    response.candidates[0].content.parts.filter((p: any) => p.functionCall).forEach((p: any, i: number) => calls.push({ id: `gemini-${i}`, name: p.functionCall.name, arguments: p.functionCall.args || {} }));
  }
  return calls;
}

export function formatToolResults(results: ToolResult[], provider: 'claude' | 'openai' | 'gemini'): any { // 格式化工具结果给 Provider
  if (provider === 'claude') return results.map(r => ({ type: 'tool_result', tool_use_id: r.id, content: JSON.stringify(r.success ? r.data : { error: r.error }) }));
  if (provider === 'openai') return results.map(r => ({ role: 'tool', tool_call_id: r.id, content: JSON.stringify(r.success ? r.data : { error: r.error }) }));
  if (provider === 'gemini') return { parts: results.map(r => ({ functionResponse: { name: r.name, response: r.success ? r.data : { error: r.error } } })) };
  return results;
}
