// AI 工具 Schema 定义
export interface ToolParameter { type: string; description: string; enum?: string[]; default?: any; items?: any; properties?: Record<string, ToolParameter>; required?: string[]; }
export interface ToolSchema { name: string; description: string; parameters: { type: 'object'; properties: Record<string, ToolParameter>; required?: string[] }; }
export interface ToolCall { id: string; name: string; arguments: Record<string, any>; }
export interface ToolResult { id: string; name: string; success: boolean; data?: any; error?: string; }

export const workspaceTools: Record<string, ToolSchema> = {
  workspace_listDir: { name: 'workspace_listDir', description: '列出指定目录下的文件和文件夹', parameters: { type: 'object', properties: { path: { type: 'string', description: '目录路径（相对于工作区或绝对路径）' }, recursive: { type: 'boolean', description: '是否递归', default: false }, maxDepth: { type: 'number', description: '最大深度', default: 3 } }, required: ['path'] } },
  workspace_readFile: { name: 'workspace_readFile', description: '读取文件内容', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' }, startLine: { type: 'number', description: '起始行(从1开始)' }, endLine: { type: 'number', description: '结束行' } }, required: ['path'] } },
  workspace_writeFile: { name: 'workspace_writeFile', description: '写入文件内容（需确认）', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' }, content: { type: 'string', description: '文件内容' }, createIfNotExist: { type: 'boolean', description: '不存在时创建', default: true } }, required: ['path', 'content'] } },
  workspace_search: { name: 'workspace_search', description: '搜索文件内容', parameters: { type: 'object', properties: { query: { type: 'string', description: '搜索关键词' }, glob: { type: 'string', description: '文件匹配模式，如 **/*.ts' }, maxResults: { type: 'number', description: '最大结果数', default: 50 } }, required: ['query'] } },
  editor_getActiveFile: { name: 'editor_getActiveFile', description: '获取当前打开的文件', parameters: { type: 'object', properties: {} } },
  editor_getSelection: { name: 'editor_getSelection', description: '获取当前选中文本', parameters: { type: 'object', properties: {} } },
  terminal_execute: { name: 'terminal_execute', description: '执行终端命令（需确认）', parameters: { type: 'object', properties: { command: { type: 'string', description: '要执行的命令' }, cwd: { type: 'string', description: '工作目录' } }, required: ['command'] } },
  diagnostics_getLogs: { name: 'diagnostics_getLogs', description: '获取终端日志', parameters: { type: 'object', properties: { lines: { type: 'number', description: '获取最近N行', default: 100 }, filter: { type: 'string', description: '过滤关键词' } } } },
  git_status: { name: 'git_status', description: '获取 Git 状态', parameters: { type: 'object', properties: {} } },
  git_diff: { name: 'git_diff', description: '获取文件差异', parameters: { type: 'object', properties: { path: { type: 'string', description: '文件路径' }, staged: { type: 'boolean', description: '是否查看暂存区', default: false } }, required: ['path'] } },
};

export const toolPermissions: Record<string, { requireConfirmation: boolean; allowInChat: boolean; allowInAgent: boolean }> = { // 工具权限配置
  workspace_listDir: { requireConfirmation: false, allowInChat: true, allowInAgent: true },
  workspace_readFile: { requireConfirmation: false, allowInChat: true, allowInAgent: true },
  workspace_writeFile: { requireConfirmation: true, allowInChat: false, allowInAgent: true },
  workspace_search: { requireConfirmation: false, allowInChat: true, allowInAgent: true },
  editor_getActiveFile: { requireConfirmation: false, allowInChat: true, allowInAgent: true },
  editor_getSelection: { requireConfirmation: false, allowInChat: true, allowInAgent: true },
  terminal_execute: { requireConfirmation: true, allowInChat: false, allowInAgent: true },
  diagnostics_getLogs: { requireConfirmation: false, allowInChat: true, allowInAgent: true },
  git_status: { requireConfirmation: false, allowInChat: true, allowInAgent: true },
  git_diff: { requireConfirmation: false, allowInChat: true, allowInAgent: true },
};

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
