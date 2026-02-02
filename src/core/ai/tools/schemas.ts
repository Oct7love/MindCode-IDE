// AI 工具 Schema 定义
export interface ToolParameter { type: string; description: string; enum?: string[]; default?: any; items?: any; properties?: Record<string, ToolParameter>; required?: string[]; }
export interface ToolSchema { name: string; description: string; parameters: { type: 'object'; properties: Record<string, ToolParameter>; required?: string[] }; }
export interface ToolCall { id: string; name: string; arguments: Record<string, any>; }
export interface ToolResult { id: string; name: string; success: boolean; data?: any; error?: string; }

export const workspaceTools: Record<string, ToolSchema> = {
  workspace_listDir: { name: 'workspace_listDir', description: '列出指定目录下的文件和文件夹', parameters: { type: 'object', properties: { path: { type: 'string', description: '目录路径（相对于工作区或绝对路径）' }, recursive: { type: 'boolean', description: '是否递归', default: false }, maxDepth: { type: 'number', description: '最大深度', default: 3 } }, required: ['path'] } },
  workspace_readFile: { name: 'workspace_readFile', description: '读取文件内容', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' }, startLine: { type: 'number', description: '起始行(从1开始)' }, endLine: { type: 'number', description: '结束行' } }, required: ['path'] } },
  workspace_writeFile: { name: 'workspace_writeFile', description: '写入文件内容（需确认）', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' }, content: { type: 'string', description: '文件内容' }, createIfNotExist: { type: 'boolean', description: '不存在时创建', default: true } }, required: ['path', 'content'] } },
  workspace_search: { name: 'workspace_search', description: '搜索文件内容（文本匹配）', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索关键词' }, glob: { type: 'string', description: '文件匹配模式，如 **/*.ts' }, maxResults: { type: 'number', description: '最大结果数', default: 50 } }, required: ['query'] } },
  codebase_semantic: { name: 'codebase_semantic', description: '语义搜索代码库（@codebase）- 使用向量嵌入找到语义相关的代码', parameters: { type: 'object', properties: { query: { type: 'string', description: '自然语言查询，如"用户认证逻辑"' }, topK: { type: 'number', description: '返回结果数', default: 5 }, fileFilter: { type: 'array', items: { type: 'string' }, description: '限制搜索的文件路径' } }, required: ['query'] } },
  editor_getActiveFile: { name: 'editor_getActiveFile', description: '获取当前打开的文件', parameters: { type: 'object', properties: {} } },
  editor_getSelection: { name: 'editor_getSelection', description: '获取当前选中文本', parameters: { type: 'object', properties: {} } },
  terminal_execute: { name: 'terminal_execute', description: '执行终端命令（需确认）', parameters: { type: 'object', properties: { command: { type: 'string', description: '要执行的命令' }, cwd: { type: 'string', description: '工作目录' } }, required: ['command'] } },
  diagnostics_getLogs: { name: 'diagnostics_getLogs', description: '获取终端日志', parameters: { type: 'object', properties: { lines: { type: 'number', description: '获取最近N行', default: 100 }, filter: { type: 'string', description: '过滤关键词' } } } },
  git_status: { name: 'git_status', description: '获取 Git 状态', parameters: { type: 'object', properties: {} } },
  git_diff: { name: 'git_diff', description: '获取文件差异', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' }, staged: { type: 'boolean', description: '是否查看暂存区', default: false } }, required: ['path'] } },
};

// 权限等级: read < write < execute < dangerous
export type PermissionLevel = 'read' | 'write' | 'execute' | 'dangerous';
export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';

export interface ToolPermission {
  level: PermissionLevel; // 操作等级
  risk: RiskLevel; // 风险等级
  requireConfirmation: boolean; // 是否需要确认
  allowInChat: boolean; // Chat 模式允许
  allowInAgent: boolean; // Agent 模式允许
  blockedPaths?: RegExp[]; // 禁止操作的路径
  blockedCommands?: RegExp[]; // 禁止的命令
}

export const toolPermissions: Record<string, ToolPermission> = {
  workspace_listDir: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
  workspace_readFile: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
  workspace_writeFile: { level: 'write', risk: 'medium', requireConfirmation: true, allowInChat: false, allowInAgent: true, blockedPaths: [/node_modules/, /\.git\//, /\.env/] },
  workspace_search: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
  codebase_semantic: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
  editor_getActiveFile: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
  editor_getSelection: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
  terminal_execute: { level: 'execute', risk: 'high', requireConfirmation: true, allowInChat: false, allowInAgent: true, blockedCommands: [/rm\s+-rf\s+\//, /format\s+c:/i, /shutdown/, /reboot/] },
  diagnostics_getLogs: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
  git_status: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
  git_diff: { level: 'read', risk: 'safe', requireConfirmation: false, allowInChat: true, allowInAgent: true },
};

/** 检查工具调用是否被阻止 */
export function isToolCallBlocked(toolName: string, args: Record<string, any>): { blocked: boolean; reason?: string } {
  const perm = toolPermissions[toolName];
  if (!perm) return { blocked: false };
  if (perm.blockedPaths && args.path) {
    for (const pattern of perm.blockedPaths) { if (pattern.test(args.path)) return { blocked: true, reason: `路径被禁止: ${args.path}` }; }
  }
  if (perm.blockedCommands && args.command) {
    for (const pattern of perm.blockedCommands) { if (pattern.test(args.command)) return { blocked: true, reason: `命令被禁止: ${args.command}` }; }
  }
  return { blocked: false };
}

export function getToolsForMode(mode: 'chat' | 'agent' | 'plan' | 'debug'): ToolSchema[] { // 按模式获取可用工具
  return Object.entries(workspaceTools).filter(([name]) => {
    const perm = toolPermissions[name];
    if (mode === 'chat') return perm?.allowInChat;
    if (mode === 'agent') return perm?.allowInAgent;
    if (mode === 'plan') return perm?.allowInChat && !perm?.requireConfirmation; // Plan 模式只读
    if (mode === 'debug') return perm?.allowInChat; // Debug 模式允许读取
    return false;
  }).map(([, schema]) => schema);
}

export function formatToolsForProvider(tools: ToolSchema[], provider: 'claude' | 'openai' | 'gemini'): any[] { // 转换为各 Provider 格式
  if (provider === 'claude') return tools.map(t => ({ name: t.name, description: t.description, input_schema: t.parameters }));
  if (provider === 'openai') return tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
  if (provider === 'gemini') return [{ functionDeclarations: tools.map(t => ({ name: t.name, description: t.description, parameters: t.parameters })) }];
  return tools;
}
