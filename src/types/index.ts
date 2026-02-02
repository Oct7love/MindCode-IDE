/**
 * Types - 全局类型定义
 */

// 基础类型
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;
export type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type DeepReadonly<T> = { readonly [K in keyof T]: T[K] extends object ? DeepReadonly<T[K]> : T[K] };
export type ValueOf<T> = T[keyof T];
export type Awaited<T> = T extends Promise<infer U> ? U : T;

// 文件相关
export interface FileInfo { path: string; name: string; size: number; isDirectory: boolean; isFile: boolean; extension: string; modifiedAt: number; createdAt: number; }
export interface FileContent { path: string; content: string; encoding: string; language: string; lineCount: number; }
export interface FileChange { type: 'create' | 'modify' | 'delete' | 'rename'; path: string; oldPath?: string; content?: string; }

// 编辑器相关
export interface Position { line: number; column: number; }
export interface Range { start: Position; end: Position; }
export interface Selection { anchor: Position; active: Position; isReversed: boolean; }
export interface TextEdit { range: Range; newText: string; }
export interface EditorState { filePath: string; content: string; language: string; selections: Selection[]; scrollTop: number; scrollLeft: number; isDirty: boolean; }

// 诊断
export type DiagnosticSeverity = 'error' | 'warning' | 'info' | 'hint';
export interface Diagnostic { range: Range; message: string; severity: DiagnosticSeverity; source?: string; code?: string | number; }

// 补全
export type CompletionKind = 'text' | 'method' | 'function' | 'constructor' | 'field' | 'variable' | 'class' | 'interface' | 'module' | 'property' | 'keyword' | 'snippet' | 'file' | 'folder';
export interface CompletionItem { label: string; kind: CompletionKind; detail?: string; documentation?: string; insertText: string; filterText?: string; sortText?: string; }

// AI 相关
export type AIRole = 'user' | 'assistant' | 'system';
export interface AIMessage { role: AIRole; content: string; timestamp: number; }
export interface AIConversation { id: string; title: string; messages: AIMessage[]; createdAt: number; updatedAt: number; }
export type AIModel = 'claude-sonnet-4-5' | 'gpt-4o' | 'gpt-4o-mini' | 'gemini-1.5-pro' | 'codesuc-sonnet' | string;
export interface AIConfig { provider: string; model: AIModel; temperature: number; maxTokens: number; topP: number; stream: boolean; systemPrompt?: string; }

// 工具调用
export interface ToolCall { id: string; name: string; arguments: Record<string, any>; }
export interface ToolResult { id: string; name: string; result: any; error?: string; }
export type ToolStatus = 'pending' | 'running' | 'success' | 'error';

// Git 相关
export type GitStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'ignored' | 'conflict';
export interface GitFile { path: string; status: GitStatus; staged: boolean; }
export interface GitCommit { hash: string; shortHash: string; message: string; author: string; date: string; }
export interface GitBranch { name: string; current: boolean; remote: boolean; ahead?: number; behind?: number; }

// 插件相关
export interface PluginManifest { id: string; name: string; version: string; description?: string; author?: string; main: string; permissions: string[]; contributes?: PluginContributes; }
export interface PluginContributes { commands?: { id: string; title: string }[]; menus?: { id: string; items: string[] }[]; keybindings?: { command: string; key: string }[]; }

// 设置相关
export interface SettingDefinition { key: string; type: 'boolean' | 'number' | 'string' | 'select' | 'array'; default: any; label: string; description?: string; options?: { value: any; label: string }[]; category: string; }
export type Settings = Record<string, any>;

// 通知
export type NotificationType = 'info' | 'success' | 'warning' | 'error';
export interface Notification { id: string; type: NotificationType; message: string; duration?: number; actions?: { label: string; handler: () => void }[]; }

// 命令
export interface Command { id: string; label: string; handler: () => void; keybinding?: string; icon?: string; category?: string; when?: string; }

// 快捷键
export interface Keybinding { id: string; command: string; keys: string; when?: string; }

// 主题
export type ThemeType = 'dark' | 'light';
export interface ThemeColors { bgBase: string; bgElevated: string; bgHover: string; textPrimary: string; textSecondary: string; textMuted: string; border: string; accent: string; success: string; warning: string; error: string; info: string; }
export interface Theme { id: string; name: string; type: ThemeType; colors: ThemeColors; }

// 布局
export interface PanelConfig { id: string; visible: boolean; size: number; minSize?: number; maxSize?: number; }
export interface LayoutConfig { sidebar: PanelConfig; aiPanel: PanelConfig; terminal: PanelConfig; bottomPanel: PanelConfig; }

// 事件
export interface AppEvents { 'file:open': { path: string }; 'file:save': { path: string }; 'file:close': { path: string }; 'editor:change': { path: string; content: string }; 'theme:change': { themeId: string }; 'settings:change': { key: string; value: any }; 'ai:message': { role: AIRole; content: string }; 'git:change': { files: GitFile[] }; }

// API 响应
export interface ApiResponse<T> { success: boolean; data?: T; error?: string; code?: number; }
export interface PaginatedResponse<T> { items: T[]; total: number; page: number; pageSize: number; hasMore: boolean; }

// IPC
export interface IPCRequest { channel: string; args: any[]; }
export interface IPCResponse<T = any> { success: boolean; data?: T; error?: string; }

export default {};
