/**
 * IPC 类型契约 —— main/renderer 的类型安全桥梁
 *
 * 所有 IPC channel 的请求参数和返回值类型在此集中定义，
 * 确保 preload.ts 和 handler 两端的类型一致性。
 */
import type { ChatMessage, ToolCallInfo, ToolSchema } from "./ai";

// ─── 通用类型 ──────────────────────────────────────────

export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** 设置值的合法类型 */
export type SettingValue = string | number | boolean | null | Record<string, unknown>;

// ─── AI 模块类型 ────────────────────────────────────────

export interface AIChatResult extends IPCResult<string> {
  errorType?: string;
  model?: string;
  usedFallback?: boolean;
}

export interface AIStatsResult {
  queue: Record<string, { running: number; queued: number }>;
  breakers: Record<string, { open: boolean; failCount: number }>;
}

export interface CompletionRequest {
  filePath: string;
  code: string;
  cursorLine: number;
  cursorColumn: number;
  model?: string;
}

export interface CompletionResult extends IPCResult<string> {
  cached?: boolean;
}

export interface CompletionSettings {
  enabled: boolean;
  model: string;
  debounceMs: number;
}

/** 流式聊天回调（渲染进程侧） */
export interface ChatStreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullText: string, meta?: { model: string; usedFallback: boolean }) => void;
  onError: (error: string, errorType?: string) => void;
  onFallback?: (from: string, to: string) => void;
}

/** 流式聊天 + 工具调用回调 */
export interface ChatStreamWithToolsCallbacks extends ChatStreamCallbacks {
  onToolCall: (calls: ToolCallInfo[]) => void;
}

/** 流式补全回调 */
export interface CompletionStreamCallbacks {
  onToken: (token: string) => void;
  onDone: (fullText: string, cached: boolean) => void;
  onError: (error: string) => void;
}

// ─── 流式 IPC 事件数据 ──────────────────────────────────

export interface StreamTokenData {
  requestId: string;
  token: string;
}

export interface StreamCompleteData {
  requestId: string;
  fullText: string;
  model?: string;
  usedFallback?: boolean;
}

export interface StreamErrorData {
  requestId: string;
  error: string;
  errorType?: string;
}

export interface StreamFallbackData {
  requestId: string;
  from: string;
  to: string;
}

export interface StreamToolCallData {
  requestId: string;
  toolCalls: ToolCallInfo[];
}

export interface CompletionStreamTokenData {
  requestId: string;
  token: string;
}

export interface CompletionStreamDoneData {
  requestId: string;
  fullText: string;
  cached: boolean;
}

export interface CompletionStreamErrorData {
  requestId: string;
  error: string;
}

// ─── 文件系统模块类型 ───────────────────────────────────

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "folder";
  isDirectory: boolean;
  isFile: boolean;
  size: number;
  extension: string;
}

export interface FileStat {
  size: number;
  isDirectory: boolean;
  isFile: boolean;
  modifiedAt: number;
  createdAt: number;
}

export interface FileChunkData {
  lines: string[];
  startLine: number;
  endLine: number;
  totalRead: number;
}

export interface FileListEntry {
  name: string;
  path: string;
  relativePath: string;
}

export interface SearchMatch {
  file: string;
  relativePath: string;
  line: number;
  column: number;
  text: string;
  matchStart: number;
  matchEnd: number;
}

export interface SearchInFilesParams {
  workspacePath: string;
  query: string;
  maxResults?: number;
}

export interface EncodingInfo {
  id: string;
  label: string;
}

// ─── 终端模块类型 ───────────────────────────────────────

export interface TerminalCreateOptions {
  cwd?: string;
  shell?: string;
}

export interface TerminalExecResult {
  stdout: string;
  stderr: string;
}

export interface TerminalDataEvent {
  id: string;
  data: string;
}

export interface TerminalExitEvent {
  id: string;
  exitCode: number;
}

// ─── Git 模块类型 ───────────────────────────────────────

export interface GitFileStatus {
  path: string;
  status: string;
  staged: boolean;
}

export interface GitBranch {
  name: string;
  current: boolean;
}

export interface GitCommitLog {
  hash: string;
  shortHash: string;
  author: string;
  email: string;
  date: string;
  message: string;
}

// ─── Dialog 模块类型 ────────────────────────────────────

export interface DialogFilter {
  name: string;
  extensions: string[];
}

export interface SaveDialogOptions {
  defaultPath?: string;
  filters?: DialogFilter[];
}

export interface OpenDialogOptions {
  filters?: DialogFilter[];
  properties?: string[];
}

export interface MessageBoxOptions {
  type?: string;
  title?: string;
  message: string;
  buttons?: string[];
}

// ─── LSP 模块类型 ───────────────────────────────────────

export interface LSPStartOptions {
  command?: string;
  args?: string[];
  rootPath?: string;
}

export interface LSPStatus {
  state: string;
  capabilities?: Record<string, unknown>;
}

export interface LSPDetectResult {
  available: boolean;
  command: string;
  installHint?: string;
}

export interface LSPNotificationData {
  language: string;
  method: string;
  params: unknown;
}

// ─── Debug 模块类型 ─────────────────────────────────────

export interface DebugConfig {
  type: string;
  name: string;
  program?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  runtimeExecutable?: string;
  runtimeArgs?: string[];
  port?: number;
  host?: string;
  sourceMaps?: boolean;
  outFiles?: string[];
  stopOnEntry?: boolean;
  console?: "internalConsole" | "integratedTerminal" | "externalTerminal";
}

export interface BreakpointOptions {
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

export interface BreakpointInfo {
  id: string;
  file: string;
  line: number;
  column?: number;
  verified: boolean;
  enabled: boolean;
  condition?: string;
  hitCondition?: string;
  logMessage?: string;
}

export interface DebugVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
  children?: DebugVariable[];
}

export interface DebugSessionInfo {
  id: string;
  name: string;
  type?: string;
  config: {
    name: string;
    type: string;
    request?: string;
    program?: string;
    args?: string[];
    cwd?: string;
    env?: Record<string, string>;
  };
  state: "inactive" | "running" | "paused" | "stopped";
  breakpoints: BreakpointInfo[];
  stackFrames: Array<{
    id: number;
    name: string;
    file: string;
    line: number;
    column: number;
    source?: string;
  }>;
  variables: DebugVariable[];
}

export interface EvaluateResult {
  result: string;
  type?: string;
  variablesReference: number;
}

// ─── Index 模块类型 ─────────────────────────────────────

export interface IndexSearchQuery {
  query: string;
  type?: string;
  limit?: number;
  fileFilter?: string[];
  kindFilter?: string[];
}

export interface IndexSearchResultItem {
  item: IndexSymbol;
  score: number;
  matchType: string;
  highlights?: string[];
  context?: string;
}

export interface IndexSearchResult {
  items: IndexSearchResultItem[];
  totalCount: number;
  timeTaken: number;
  hasMore: boolean;
}

export interface IndexSymbol {
  id: string;
  name: string;
  kind: string;
  filePath: string;
  startLine: number;
  endLine: number;
  containerName?: string;
  signature?: string;
}

export interface IndexProgress {
  status: string; // 'idle' | 'scanning' | 'indexing' | 'complete' | 'error' 等
  totalFiles: number;
  indexedFiles: number;
  currentFile?: string;
}

export interface IndexStats {
  totalFiles: number;
  totalSymbols: number;
  totalCallRelations: number;
  totalDependencies: number;
  totalChunks: number;
}

export interface IndexFileEvent {
  filePath: string;
  symbolCount: number;
}

export interface IndexCompleteStats {
  files: number;
  symbols: number;
  time: number;
}

export interface RelatedCodeEntry {
  filePath: string;
  code: string;
  relevance: number;
}

// ─── 菜单事件类型 ───────────────────────────────────────

export type MenuEvent =
  | "menu:newFile"
  | "menu:openFile"
  | "menu:openFolder"
  | "menu:save"
  | "menu:saveAs"
  | "menu:closeEditor"
  | "menu:find"
  | "menu:findInFiles"
  | "menu:replace"
  | "menu:commandPalette"
  | "menu:showExplorer"
  | "menu:showSearch"
  | "menu:showGit"
  | "menu:toggleTerminal"
  | "menu:toggleAI"
  | "menu:goToFile"
  | "menu:goToLine"
  | "menu:newTerminal";

// ─── IPC Channel 映射 ──────────────────────────────────

/** invoke 通道：请求/响应模式 */
export interface IPCInvokeChannelMap {
  // 应用
  "get-app-version": { params: []; result: string };

  // AI
  "ai-chat": {
    params: [{ model: string; messages: ChatMessage[] }];
    result: AIChatResult;
  };
  "ai-stats": { params: []; result: AIStatsResult };
  "ai:completion": { params: [CompletionRequest]; result: CompletionResult };
  "ai:completion-settings": { params: []; result: CompletionSettings };
  "ai:completion-settings-set": {
    params: [Partial<CompletionSettings>];
    result: IPCResult;
  };

  // 文件系统
  "fs:openFolder": { params: []; result: string | null };
  "fs:readDir": { params: [string]; result: IPCResult<FileEntry[]> };
  "fs:readFile": {
    params: [string, string?];
    result: IPCResult<string> & { encoding?: string };
  };
  "fs:readFileChunk": {
    params: [string, number, number];
    result: IPCResult<FileChunkData>;
  };
  "fs:getLineCount": { params: [string]; result: IPCResult<number> };
  "fs:writeFile": { params: [string, string, string?]; result: IPCResult };
  "fs:stat": { params: [string]; result: IPCResult<FileStat> };
  "fs:getEncodings": { params: []; result: EncodingInfo[] };
  "fs:detectEncoding": {
    params: [string];
    result: IPCResult & { encoding?: string };
  };
  "fs:getAllFiles": { params: [string]; result: IPCResult<FileListEntry[]> };
  "fs:searchInFiles": {
    params: [SearchInFilesParams];
    result: IPCResult<SearchMatch[]>;
  };
  "fs:createFolder": { params: [string]; result: IPCResult };
  "fs:createFile": { params: [string, string?]; result: IPCResult };
  "fs:delete": { params: [string]; result: IPCResult };
  "fs:rename": { params: [string, string]; result: IPCResult };
  "fs:copy": { params: [string, string]; result: IPCResult };
  "fs:exists": { params: [string]; result: IPCResult<boolean> };

  // 设置
  "settings:get": { params: [string]; result: SettingValue };
  "settings:set": { params: [string, SettingValue]; result: void };

  // 终端
  "terminal:execute": {
    params: [string, string?];
    result: IPCResult<TerminalExecResult>;
  };
  "terminal:cd": { params: [string, string]; result: IPCResult<string> };
  "terminal:pwd": { params: []; result: IPCResult<string> };
  "terminal:create": {
    params: [TerminalCreateOptions?];
    result: IPCResult & { id?: string };
  };
  "terminal:write": { params: [string, string]; result: IPCResult };
  "terminal:resize": { params: [string, number, number]; result: IPCResult };
  "terminal:close": { params: [string]; result: IPCResult };

  // Git
  "git:isRepo": { params: [string]; result: IPCResult<boolean> };
  "git:status": { params: [string]; result: IPCResult<GitFileStatus[]> };
  "git:currentBranch": { params: [string]; result: IPCResult<string> };
  "git:branches": { params: [string]; result: IPCResult<GitBranch[]> };
  "git:stage": { params: [string, string[]]; result: IPCResult };
  "git:unstage": { params: [string, string[]]; result: IPCResult };
  "git:commit": { params: [string, string]; result: IPCResult };
  "git:diff": { params: [string, string, boolean?]; result: IPCResult<string> };
  "git:checkout": { params: [string, string]; result: IPCResult };
  "git:createBranch": { params: [string, string]; result: IPCResult };
  "git:log": {
    params: [string, number?];
    result: IPCResult<GitCommitLog[]>;
  };
  "git:discard": { params: [string, string]; result: IPCResult };

  // Dialog
  "dialog:showSaveDialog": {
    params: [SaveDialogOptions];
    result: { canceled: boolean; filePath?: string };
  };
  "dialog:showOpenDialog": {
    params: [OpenDialogOptions];
    result: { canceled: boolean; filePaths?: string[] };
  };
  "dialog:showMessageBox": {
    params: [MessageBoxOptions];
    result: { response: number };
  };

  // LSP
  "lsp:start": {
    params: [string, LSPStartOptions?];
    result: IPCResult & { capabilities?: Record<string, unknown> };
  };
  "lsp:stop": { params: [string]; result: IPCResult };
  "lsp:request": {
    params: [string, string, unknown];
    result: IPCResult<unknown>;
  };
  "lsp:notify": { params: [string, string, unknown]; result: IPCResult };
  "lsp:status": { params: [string]; result: LSPStatus | null };
  "lsp:detect": { params: [string]; result: LSPDetectResult };

  // Debug
  "debug:start": {
    params: [DebugConfig];
    result: IPCResult & { sessionId?: string };
  };
  "debug:stop": { params: [string?]; result: IPCResult };
  "debug:continue": { params: [string?]; result: IPCResult };
  "debug:stepOver": { params: [string?]; result: IPCResult };
  "debug:stepInto": { params: [string?]; result: IPCResult };
  "debug:stepOut": { params: [string?]; result: IPCResult };
  "debug:pause": { params: [string?]; result: IPCResult };
  "debug:restart": { params: [string?]; result: IPCResult };
  "debug:addBreakpoint": {
    params: [string, number, BreakpointOptions?];
    result: IPCResult & { id?: string };
  };
  "debug:removeBreakpoint": { params: [string]; result: IPCResult };
  "debug:toggleBreakpoint": { params: [string, number]; result: IPCResult };
  "debug:getBreakpoints": {
    params: [string?];
    result: IPCResult<BreakpointInfo[]>;
  };
  "debug:getVariables": {
    params: [number?];
    result: IPCResult<DebugVariable[]>;
  };
  "debug:evaluate": {
    params: [string, number?];
    result: IPCResult<EvaluateResult>;
  };
  "debug:getSession": {
    params: [string?];
    result: IPCResult<DebugSessionInfo>;
  };
  "debug:listSessions": {
    params: [];
    result: IPCResult<DebugSessionInfo[]>;
  };

  // Index
  "index:indexWorkspace": {
    params: [string];
    result: IPCResult & { message?: string };
  };
  "index:getProgress": { params: []; result: IndexProgress };
  "index:getStats": { params: []; result: IndexStats };
  "index:search": {
    params: [IndexSearchQuery];
    result: IPCResult<IndexSearchResult>;
  };
  "index:searchSymbols": {
    params: [string, number?];
    result: IPCResult<IndexSymbol[]>;
  };
  "index:getFileSymbols": {
    params: [string];
    result: IPCResult<IndexSymbol[]>;
  };
  "index:findDefinition": {
    params: [string];
    result: IPCResult<IndexSymbol>;
  };
  "index:findReferences": {
    params: [string];
    result: IPCResult<IndexSymbol[]>;
  };
  "index:getRelatedCode": {
    params: [string, number?];
    result: IPCResult<RelatedCodeEntry[]>;
  };
  "index:cancel": { params: []; result: IPCResult };
  "index:clear": { params: []; result: IPCResult };
}

/** send 通道：主进程 → 渲染进程事件 */
export interface IPCEventChannelMap {
  // AI 流式事件
  "ai-stream-token": StreamTokenData;
  "ai-stream-complete": StreamCompleteData;
  "ai-stream-error": StreamErrorData;
  "ai-stream-fallback": StreamFallbackData;
  "ai-stream-tool-call": StreamToolCallData;
  "ai:completion-stream-token": CompletionStreamTokenData;
  "ai:completion-stream-done": CompletionStreamDoneData;
  "ai:completion-stream-error": CompletionStreamErrorData;

  // 终端事件
  "terminal:data": TerminalDataEvent;
  "terminal:exit": TerminalExitEvent;

  // 主题 & 文件监听
  "theme:change": string;
  "fs:fileChanged": { filePath: string; type: string };

  // LSP 通知
  "lsp:notification": LSPNotificationData;

  // 索引事件
  "index:progress": IndexProgress;
  "index:fileIndexed": IndexFileEvent;
  "index:complete": IndexCompleteStats;
}

/** 类型安全的 invoke 辅助类型 */
export type TypedIPCInvoke = <K extends keyof IPCInvokeChannelMap>(
  channel: K,
  ...args: IPCInvokeChannelMap[K]["params"]
) => Promise<IPCInvokeChannelMap[K]["result"]>;

/** 类型安全的事件监听辅助类型 */
export type TypedIPCOn = <K extends keyof IPCEventChannelMap>(
  channel: K,
  callback: (data: IPCEventChannelMap[K]) => void,
) => () => void;

/** IPC 事件处理器类型（preload 中 ipcRenderer.on 的回调签名） */
export type IPCEventHandler<K extends keyof IPCEventChannelMap> = (
  event: Electron.IpcRendererEvent,
  data: IPCEventChannelMap[K],
) => void;
