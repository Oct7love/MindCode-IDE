import { contextBridge, ipcRenderer } from "electron";
import type { IpcRendererEvent } from "electron";
import type { ChatMessage, ToolSchema } from "../shared/types/ai";
import type {
  SettingValue,
  CompletionRequest,
  CompletionStreamCallbacks,
  ChatStreamCallbacks,
  ChatStreamWithToolsCallbacks,
  StreamTokenData,
  StreamCompleteData,
  StreamErrorData,
  StreamFallbackData,
  StreamToolCallData,
  CompletionStreamTokenData,
  CompletionStreamDoneData,
  CompletionStreamErrorData,
  TerminalDataEvent,
  TerminalExitEvent,
  DebugConfig,
  BreakpointOptions,
  MenuEvent,
  LSPNotificationData,
  IndexProgress,
  IndexFileEvent,
  IndexCompleteStats,
  SearchInFilesParams,
  AIChatResult,
  AIStatsResult,
  BreakpointInfo,
  CompletionResult,
  CompletionSettings,
  DebugSessionInfo,
  DebugVariable,
  EncodingInfo,
  EvaluateResult,
  FileChunkData,
  FileEntry,
  FileListEntry,
  FileStat,
  GitBranch,
  GitCommitLog,
  GitFileStatus,
  IndexSearchQuery,
  IndexSearchResult,
  IndexStats,
  IndexSymbol,
  IPCResult,
  LSPDetectResult,
  LSPStatus,
  MessageBoxOptions,
  OpenDialogOptions,
  RelatedCodeEntry,
  SaveDialogOptions,
  SearchMatch,
  TerminalExecResult,
} from "../shared/types/ipc";
import type { IPCResult as MainIPCResult } from "./ipc/types";

// 窗口控制 API (TitleBar 使用)
contextBridge.exposeInMainWorld("electronAPI", {
  minimizeWindow: () => ipcRenderer.send("window:minimize"),
  maximizeWindow: () => ipcRenderer.send("window:maximize"),
  closeWindow: () => ipcRenderer.send("window:close"),
  isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
  showAppMenu: (x: number, y: number) => ipcRenderer.send("window:showMenu", x, y),
});

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld("mindcode", {
  // 应用信息
  getVersion: () => ipcRenderer.invoke("get-app-version"),

  // AI 服务
  ai: {
    chat: (model: string, messages: ChatMessage[]) =>
      ipcRenderer.invoke("ai-chat", { model, messages }),
    getStats: () => ipcRenderer.invoke("ai-stats"),
    cancelStream: (requestId: string) => ipcRenderer.send("ai-stream-cancel", { requestId }),
    // 代码补全
    completion: (request: CompletionRequest) => ipcRenderer.invoke("ai:completion", request),
    getCompletionSettings: () => ipcRenderer.invoke("ai:completion-settings"),
    setCompletionSettings: (settings: { enabled?: boolean; model?: string; debounceMs?: number }) =>
      ipcRenderer.invoke("ai:completion-settings-set", settings),
    // 流式代码补全
    completionStream: (request: CompletionRequest, callbacks: CompletionStreamCallbacks) => {
      const requestId = `comp-stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tokenHandler = (_: IpcRendererEvent, data: CompletionStreamTokenData) => {
        if (data.requestId === requestId) callbacks.onToken(data.token);
      };
      const doneHandler = (_: IpcRendererEvent, data: CompletionStreamDoneData) => {
        if (data.requestId === requestId) {
          callbacks.onDone(data.fullText, data.cached);
          cleanup();
        }
      };
      const errorHandler = (_: IpcRendererEvent, data: CompletionStreamErrorData) => {
        if (data.requestId === requestId) {
          callbacks.onError(data.error);
          cleanup();
        }
      };
      const cleanup = () => {
        ipcRenderer.removeListener("ai:completion-stream-token", tokenHandler);
        ipcRenderer.removeListener("ai:completion-stream-done", doneHandler);
        ipcRenderer.removeListener("ai:completion-stream-error", errorHandler);
      };
      ipcRenderer.on("ai:completion-stream-token", tokenHandler);
      ipcRenderer.on("ai:completion-stream-done", doneHandler);
      ipcRenderer.on("ai:completion-stream-error", errorHandler);
      ipcRenderer.send("ai:completion-stream", { ...request, requestId });
      return cleanup;
    },
    chatStream: (model: string, messages: ChatMessage[], callbacks: ChatStreamCallbacks) => {
      const requestId = `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tokenHandler = (_: IpcRendererEvent, data: StreamTokenData) => {
        if (data.requestId === requestId) callbacks.onToken(data.token);
      };
      const completeHandler = (_: IpcRendererEvent, data: StreamCompleteData) => {
        if (data.requestId === requestId) {
          callbacks.onComplete(data.fullText, {
            model: data.model || model,
            usedFallback: data.usedFallback || false,
          });
          cleanup();
        }
      };
      const errorHandler = (_: IpcRendererEvent, data: StreamErrorData) => {
        if (data.requestId === requestId) {
          callbacks.onError(data.error, data.errorType);
          cleanup();
        }
      };
      const fallbackHandler = (_: IpcRendererEvent, data: StreamFallbackData) => {
        if (data.requestId === requestId && callbacks.onFallback) {
          callbacks.onFallback(data.from, data.to);
        }
      };
      const cleanup = () => {
        ipcRenderer.removeListener("ai-stream-token", tokenHandler);
        ipcRenderer.removeListener("ai-stream-complete", completeHandler);
        ipcRenderer.removeListener("ai-stream-error", errorHandler);
        ipcRenderer.removeListener("ai-stream-fallback", fallbackHandler);
      };
      ipcRenderer.on("ai-stream-token", tokenHandler);
      ipcRenderer.on("ai-stream-complete", completeHandler);
      ipcRenderer.on("ai-stream-error", errorHandler);
      ipcRenderer.on("ai-stream-fallback", fallbackHandler);
      ipcRenderer.send("ai-chat-stream", { model, messages, requestId });
      return cleanup;
    },
    chatStreamWithTools: (
      model: string,
      messages: ChatMessage[],
      tools: ToolSchema[],
      callbacks: ChatStreamWithToolsCallbacks,
    ) => {
      const requestId = `stream-tools-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tokenHandler = (_: IpcRendererEvent, data: StreamTokenData) => {
        if (data.requestId === requestId) callbacks.onToken(data.token);
      };
      const toolCallHandler = (_: IpcRendererEvent, data: StreamToolCallData) => {
        if (data.requestId === requestId) callbacks.onToolCall(data.toolCalls);
      };
      const completeHandler = (_: IpcRendererEvent, data: StreamCompleteData) => {
        if (data.requestId === requestId) {
          callbacks.onComplete(data.fullText, {
            model: data.model || model,
            usedFallback: data.usedFallback || false,
          });
          cleanup();
        }
      };
      const errorHandler = (_: IpcRendererEvent, data: StreamErrorData) => {
        if (data.requestId === requestId) {
          callbacks.onError(data.error, data.errorType);
          cleanup();
        }
      };
      const fallbackHandler = (_: IpcRendererEvent, data: StreamFallbackData) => {
        if (data.requestId === requestId && callbacks.onFallback) {
          callbacks.onFallback(data.from, data.to);
        }
      };
      const cleanup = () => {
        ipcRenderer.removeListener("ai-stream-token", tokenHandler);
        ipcRenderer.removeListener("ai-stream-tool-call", toolCallHandler);
        ipcRenderer.removeListener("ai-stream-complete", completeHandler);
        ipcRenderer.removeListener("ai-stream-error", errorHandler);
        ipcRenderer.removeListener("ai-stream-fallback", fallbackHandler);
      };
      ipcRenderer.on("ai-stream-token", tokenHandler);
      ipcRenderer.on("ai-stream-tool-call", toolCallHandler);
      ipcRenderer.on("ai-stream-complete", completeHandler);
      ipcRenderer.on("ai-stream-error", errorHandler);
      ipcRenderer.on("ai-stream-fallback", fallbackHandler);
      ipcRenderer.send("ai-chat-stream-with-tools", { model, messages, tools, requestId });
      return cleanup;
    },
  },

  // 文件系统操作
  fs: {
    setWorkspace: (workspacePath: string) => ipcRenderer.invoke("fs:setWorkspace", workspacePath),
    openFolder: () => ipcRenderer.invoke("fs:openFolder"),
    readDir: (dirPath: string) => ipcRenderer.invoke("fs:readDir", dirPath),
    readFile: (filePath: string, encoding?: string) =>
      ipcRenderer.invoke("fs:readFile", filePath, encoding),
    readFileChunk: (filePath: string, startLine: number, endLine: number) =>
      ipcRenderer.invoke("fs:readFileChunk", filePath, startLine, endLine),
    getLineCount: (filePath: string) => ipcRenderer.invoke("fs:getLineCount", filePath),
    writeFile: (filePath: string, content: string, encoding?: string) =>
      ipcRenderer.invoke("fs:writeFile", filePath, content, encoding),
    stat: (filePath: string) => ipcRenderer.invoke("fs:stat", filePath),
    getEncodings: () => ipcRenderer.invoke("fs:getEncodings"),
    detectEncoding: (filePath: string) => ipcRenderer.invoke("fs:detectEncoding", filePath),
    getAllFiles: (workspacePath: string) => ipcRenderer.invoke("fs:getAllFiles", workspacePath),
    searchInFiles: (params: SearchInFilesParams) => ipcRenderer.invoke("fs:searchInFiles", params),
    createFolder: (folderPath: string) => ipcRenderer.invoke("fs:createFolder", folderPath),
    createFile: (filePath: string, content?: string) =>
      ipcRenderer.invoke("fs:createFile", filePath, content || ""),
    delete: (targetPath: string) => ipcRenderer.invoke("fs:delete", targetPath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke("fs:rename", oldPath, newPath),
    copy: (srcPath: string, destPath: string) => ipcRenderer.invoke("fs:copy", srcPath, destPath),
    exists: (targetPath: string) => ipcRenderer.invoke("fs:exists", targetPath),
  },

  // 设置
  settings: {
    get: (key: string) => ipcRenderer.invoke("settings:get", key),
    set: (key: string, value: SettingValue) => ipcRenderer.invoke("settings:set", key, value),
  },

  // 终端操作
  terminal: {
    execute: (command: string, cwd?: string) =>
      ipcRenderer.invoke("terminal:execute", command, cwd),
    cd: (currentDir: string, newDir: string) =>
      ipcRenderer.invoke("terminal:cd", currentDir, newDir),
    pwd: () => ipcRenderer.invoke("terminal:pwd"),
    create: (options?: { cwd?: string }) => ipcRenderer.invoke("terminal:create", options),
    write: (id: string, data: string) => ipcRenderer.invoke("terminal:write", id, data),
    resize: (id: string, cols: number, rows: number) =>
      ipcRenderer.invoke("terminal:resize", id, cols, rows),
    close: (id: string) => ipcRenderer.invoke("terminal:close", id),
    onData: (callback: (data: TerminalDataEvent) => void) => {
      const handler = (_: IpcRendererEvent, data: TerminalDataEvent) => callback(data);
      ipcRenderer.on("terminal:data", handler);
      return () => ipcRenderer.removeListener("terminal:data", handler);
    },
    onExit: (callback: (data: TerminalExitEvent) => void) => {
      const handler = (_: IpcRendererEvent, data: TerminalExitEvent) => callback(data);
      ipcRenderer.on("terminal:exit", handler);
      return () => ipcRenderer.removeListener("terminal:exit", handler);
    },
  },

  // Git 操作
  git: {
    isRepo: (workspacePath: string) => ipcRenderer.invoke("git:isRepo", workspacePath),
    status: (workspacePath: string) => ipcRenderer.invoke("git:status", workspacePath),
    currentBranch: (workspacePath: string) =>
      ipcRenderer.invoke("git:currentBranch", workspacePath),
    branches: (workspacePath: string) => ipcRenderer.invoke("git:branches", workspacePath),
    stage: (workspacePath: string, filePaths: string[]) =>
      ipcRenderer.invoke("git:stage", workspacePath, filePaths),
    unstage: (workspacePath: string, filePaths: string[]) =>
      ipcRenderer.invoke("git:unstage", workspacePath, filePaths),
    commit: (workspacePath: string, message: string) =>
      ipcRenderer.invoke("git:commit", workspacePath, message),
    diff: (workspacePath: string, filePath: string, staged?: boolean) =>
      ipcRenderer.invoke("git:diff", workspacePath, filePath, staged || false),
    checkout: (workspacePath: string, branchName: string) =>
      ipcRenderer.invoke("git:checkout", workspacePath, branchName),
    createBranch: (workspacePath: string, branchName: string) =>
      ipcRenderer.invoke("git:createBranch", workspacePath, branchName),
    log: (workspacePath: string, limit?: number) =>
      ipcRenderer.invoke("git:log", workspacePath, limit || 50),
    discard: (workspacePath: string, filePath: string) =>
      ipcRenderer.invoke("git:discard", workspacePath, filePath),
  },

  // 菜单事件监听
  onMenuEvent: (callback: (event: MenuEvent, data?: unknown) => void) => {
    const events: MenuEvent[] = [
      "menu:newFile",
      "menu:openFile",
      "menu:openFolder",
      "menu:save",
      "menu:saveAs",
      "menu:closeEditor",
      "menu:find",
      "menu:findInFiles",
      "menu:replace",
      "menu:commandPalette",
      "menu:showExplorer",
      "menu:showSearch",
      "menu:showGit",
      "menu:toggleTerminal",
      "menu:toggleAI",
      "menu:goToFile",
      "menu:goToLine",
      "menu:newTerminal",
    ];
    const handlers: Record<string, (event: IpcRendererEvent, data?: unknown) => void> = {};
    events.forEach((event) => {
      handlers[event] = (_: IpcRendererEvent, data?: unknown) => callback(event, data);
      ipcRenderer.on(event, handlers[event]);
    });
    return () => {
      events.forEach((event) => {
        ipcRenderer.removeListener(event, handlers[event]);
      });
    };
  },

  // 主题切换监听
  onThemeChange: (callback: (themeId: string) => void) => {
    const handler = (_: IpcRendererEvent, themeId: string) => callback(themeId);
    ipcRenderer.on("theme:change", handler);
    return () => {
      ipcRenderer.removeListener("theme:change", handler);
    };
  },

  // 文件系统变更监听
  onFileSystemChange: (callback: (data: { filePath: string; type: string }) => void) => {
    const handler = (_: IpcRendererEvent, data: { filePath: string; type: string }) =>
      callback(data);
    ipcRenderer.on("fs:fileChanged", handler);
    return () => {
      ipcRenderer.removeListener("fs:fileChanged", handler);
    };
  },

  // 对话框
  dialog: {
    showSaveDialog: (options: {
      defaultPath?: string;
      filters?: { name: string; extensions: string[] }[];
    }) => ipcRenderer.invoke("dialog:showSaveDialog", options),
    showOpenDialog: (options: {
      filters?: { name: string; extensions: string[] }[];
      properties?: string[];
    }) => ipcRenderer.invoke("dialog:showOpenDialog", options),
    showMessageBox: (options: {
      type?: string;
      title?: string;
      message: string;
      buttons?: string[];
    }) => ipcRenderer.invoke("dialog:showMessageBox", options),
  },

  // LSP 语言服务器
  lsp: {
    start: (language: string, options?: { rootPath?: string }) =>
      ipcRenderer.invoke("lsp:start", language, options),
    stop: (language: string) => ipcRenderer.invoke("lsp:stop", language),
    request: (language: string, method: string, params: unknown) =>
      ipcRenderer.invoke("lsp:request", language, method, params),
    notify: (language: string, method: string, params: unknown) =>
      ipcRenderer.invoke("lsp:notify", language, method, params),
    status: (language: string) => ipcRenderer.invoke("lsp:status", language),
    detect: (language: string) => ipcRenderer.invoke("lsp:detect", language),
    onNotification: (callback: (data: LSPNotificationData) => void) => {
      const handler = (_: IpcRendererEvent, data: LSPNotificationData) => callback(data);
      ipcRenderer.on("lsp:notification", handler);
      return () => ipcRenderer.removeListener("lsp:notification", handler);
    },
  },

  // 调试器
  debug: {
    start: (config: DebugConfig) => ipcRenderer.invoke("debug:start", config),
    stop: (sessionId?: string) => ipcRenderer.invoke("debug:stop", sessionId),
    continue: (sessionId?: string) => ipcRenderer.invoke("debug:continue", sessionId),
    stepOver: (sessionId?: string) => ipcRenderer.invoke("debug:stepOver", sessionId),
    stepInto: (sessionId?: string) => ipcRenderer.invoke("debug:stepInto", sessionId),
    stepOut: (sessionId?: string) => ipcRenderer.invoke("debug:stepOut", sessionId),
    pause: (sessionId?: string) => ipcRenderer.invoke("debug:pause", sessionId),
    restart: (sessionId?: string) => ipcRenderer.invoke("debug:restart", sessionId),
    addBreakpoint: (file: string, line: number, options?: BreakpointOptions) =>
      ipcRenderer.invoke("debug:addBreakpoint", file, line, options),
    removeBreakpoint: (breakpointId: string) =>
      ipcRenderer.invoke("debug:removeBreakpoint", breakpointId),
    toggleBreakpoint: (file: string, line: number) =>
      ipcRenderer.invoke("debug:toggleBreakpoint", file, line),
    getBreakpoints: (file?: string) => ipcRenderer.invoke("debug:getBreakpoints", file),
    getVariables: (frameId?: number) => ipcRenderer.invoke("debug:getVariables", frameId),
    evaluate: (expression: string, frameId?: number) =>
      ipcRenderer.invoke("debug:evaluate", expression, frameId),
    getSession: (sessionId?: string) => ipcRenderer.invoke("debug:getSession", sessionId),
    listSessions: () => ipcRenderer.invoke("debug:listSessions"),
  },

  // 代码索引服务
  index: {
    indexWorkspace: (workspacePath: string) =>
      ipcRenderer.invoke("index:indexWorkspace", workspacePath),
    getProgress: () => ipcRenderer.invoke("index:getProgress"),
    getStats: () => ipcRenderer.invoke("index:getStats"),
    search: (query: {
      query: string;
      type?: string;
      limit?: number;
      fileFilter?: string[];
      kindFilter?: string[];
    }) => ipcRenderer.invoke("index:search", query),
    searchSymbols: (name: string, limit?: number) =>
      ipcRenderer.invoke("index:searchSymbols", name, limit),
    getFileSymbols: (filePath: string) => ipcRenderer.invoke("index:getFileSymbols", filePath),
    findDefinition: (symbolName: string) => ipcRenderer.invoke("index:findDefinition", symbolName),
    findReferences: (symbolId: string) => ipcRenderer.invoke("index:findReferences", symbolId),
    getRelatedCode: (query: string, limit?: number) =>
      ipcRenderer.invoke("index:getRelatedCode", query, limit),
    cancel: () => ipcRenderer.invoke("index:cancel"),
    clear: () => ipcRenderer.invoke("index:clear"),
    onProgress: (callback: (progress: IndexProgress) => void) => {
      const handler = (_: IpcRendererEvent, progress: IndexProgress) => callback(progress);
      ipcRenderer.on("index:progress", handler);
      return () => ipcRenderer.removeListener("index:progress", handler);
    },
    onFileIndexed: (callback: (data: IndexFileEvent) => void) => {
      const handler = (_: IpcRendererEvent, data: IndexFileEvent) => callback(data);
      ipcRenderer.on("index:fileIndexed", handler);
      return () => ipcRenderer.removeListener("index:fileIndexed", handler);
    },
    onComplete: (callback: (stats: IndexCompleteStats) => void) => {
      const handler = (_: IpcRendererEvent, stats: IndexCompleteStats) => callback(stats);
      ipcRenderer.on("index:complete", handler);
      return () => ipcRenderer.removeListener("index:complete", handler);
    },
  },

  // 性能 Dashboard
  dashboard: {
    getStats: () => ipcRenderer.invoke("dashboard:stats"),
  },

  // 日志服务
  log: {
    write: (entry: {
      level: string;
      message: string;
      source?: string;
      data?: unknown;
      traceId?: string;
    }) => ipcRenderer.send("log:write", entry),
    getPath: () => ipcRenderer.invoke("log:getPath") as Promise<string | null>,
    export: () => ipcRenderer.invoke("log:export") as Promise<string>,
  },

  // 插件管理
  plugins: {
    list: () => ipcRenderer.invoke("plugins:list"),
    verify: (pluginId: string) => ipcRenderer.invoke("plugins:verify", pluginId),
    uninstall: (pluginId: string) => ipcRenderer.invoke("plugins:uninstall", pluginId),
    getDir: () => ipcRenderer.invoke("plugins:getDir"),
  },
});

// ─── 全局类型声明 ────────────────────────────────────────
// 引用 IPC 类型定义，确保渲染进程调用时获得完整类型推导

declare global {
  interface Window {
    electronAPI: {
      minimizeWindow: () => void;
      maximizeWindow: () => Promise<void>;
      closeWindow: () => void;
      isMaximized: () => Promise<boolean>;
      showAppMenu: (x: number, y: number) => void;
    };
    mindcode: {
      getVersion: () => Promise<string>;
      ai: {
        chat: (model: string, messages: ChatMessage[]) => Promise<AIChatResult>;
        getStats: () => Promise<AIStatsResult>;
        cancelStream: (requestId: string) => void;
        chatStream: (
          model: string,
          messages: ChatMessage[],
          callbacks: ChatStreamCallbacks,
        ) => () => void;
        chatStreamWithTools: (
          model: string,
          messages: ChatMessage[],
          tools: ToolSchema[],
          callbacks: ChatStreamWithToolsCallbacks,
        ) => () => void;
        completion: (request: CompletionRequest) => Promise<CompletionResult>;
        getCompletionSettings: () => Promise<CompletionSettings>;
        setCompletionSettings: (settings: Partial<CompletionSettings>) => Promise<IPCResult>;
        completionStream: (
          request: CompletionRequest,
          callbacks: CompletionStreamCallbacks,
        ) => () => void;
      };
      fs: {
        setWorkspace: (workspacePath: string) => Promise<IPCResult>;
        openFolder: () => Promise<string | null>;
        readDir: (dirPath: string) => Promise<IPCResult<FileEntry[]>>;
        readFile: (
          filePath: string,
          encoding?: string,
        ) => Promise<IPCResult<string> & { encoding?: string }>;
        readFileChunk: (
          filePath: string,
          startLine: number,
          endLine: number,
        ) => Promise<IPCResult<FileChunkData>>;
        getLineCount: (filePath: string) => Promise<IPCResult<number>>;
        writeFile: (filePath: string, content: string, encoding?: string) => Promise<IPCResult>;
        stat: (filePath: string) => Promise<IPCResult<FileStat>>;
        getEncodings: () => Promise<EncodingInfo[]>;
        detectEncoding: (filePath: string) => Promise<IPCResult & { encoding?: string }>;
        getAllFiles: (workspacePath: string) => Promise<IPCResult<FileListEntry[]>>;
        searchInFiles: (params: SearchInFilesParams) => Promise<IPCResult<SearchMatch[]>>;
        createFolder: (folderPath: string) => Promise<IPCResult>;
        createFile: (filePath: string, content?: string) => Promise<IPCResult>;
        delete: (targetPath: string) => Promise<IPCResult>;
        rename: (oldPath: string, newPath: string) => Promise<IPCResult>;
        copy: (srcPath: string, destPath: string) => Promise<IPCResult>;
        exists: (targetPath: string) => Promise<IPCResult<boolean>>;
      };
      settings: {
        get: (key: string) => Promise<SettingValue>;
        set: (key: string, value: SettingValue) => Promise<void>;
      };
      terminal: {
        execute: (command: string, cwd?: string) => Promise<IPCResult<TerminalExecResult>>;
        cd: (currentDir: string, newDir: string) => Promise<IPCResult<string>>;
        pwd: () => Promise<IPCResult<string>>;
        create: (options?: { cwd?: string }) => Promise<IPCResult & { id?: string }>;
        write: (id: string, data: string) => Promise<IPCResult>;
        resize: (id: string, cols: number, rows: number) => Promise<IPCResult>;
        close: (id: string) => Promise<IPCResult>;
        onData: (callback: (data: TerminalDataEvent) => void) => () => void;
        onExit: (callback: (data: TerminalExitEvent) => void) => () => void;
      };
      git: {
        isRepo: (workspacePath: string) => Promise<IPCResult<boolean>>;
        status: (workspacePath: string) => Promise<IPCResult<GitFileStatus[]>>;
        currentBranch: (workspacePath: string) => Promise<IPCResult<string>>;
        branches: (workspacePath: string) => Promise<IPCResult<GitBranch[]>>;
        stage: (workspacePath: string, filePaths: string[]) => Promise<IPCResult>;
        unstage: (workspacePath: string, filePaths: string[]) => Promise<IPCResult>;
        commit: (workspacePath: string, message: string) => Promise<IPCResult>;
        diff: (
          workspacePath: string,
          filePath: string,
          staged?: boolean,
        ) => Promise<IPCResult<string>>;
        checkout: (workspacePath: string, branchName: string) => Promise<IPCResult>;
        createBranch: (workspacePath: string, branchName: string) => Promise<IPCResult>;
        log: (workspacePath: string, limit?: number) => Promise<IPCResult<GitCommitLog[]>>;
        discard: (workspacePath: string, filePath: string) => Promise<IPCResult>;
      };
      onMenuEvent: (callback: (event: MenuEvent, data?: unknown) => void) => () => void;
      onThemeChange: (callback: (themeId: string) => void) => () => void;
      onFileSystemChange: (
        callback: (data: { filePath: string; type: string }) => void,
      ) => () => void;
      dialog: {
        showSaveDialog: (
          options: SaveDialogOptions,
        ) => Promise<{ canceled: boolean; filePath?: string }>;
        showOpenDialog: (
          options: OpenDialogOptions,
        ) => Promise<{ canceled: boolean; filePaths?: string[] }>;
        showMessageBox: (options: MessageBoxOptions) => Promise<{ response: number }>;
      };
      debug: {
        start: (config: DebugConfig) => Promise<IPCResult & { sessionId?: string }>;
        stop: (sessionId?: string) => Promise<IPCResult>;
        continue: (sessionId?: string) => Promise<IPCResult>;
        stepOver: (sessionId?: string) => Promise<IPCResult>;
        stepInto: (sessionId?: string) => Promise<IPCResult>;
        stepOut: (sessionId?: string) => Promise<IPCResult>;
        pause: (sessionId?: string) => Promise<IPCResult>;
        restart: (sessionId?: string) => Promise<IPCResult>;
        addBreakpoint: (
          file: string,
          line: number,
          options?: BreakpointOptions,
        ) => Promise<IPCResult & { id?: string }>;
        removeBreakpoint: (breakpointId: string) => Promise<IPCResult>;
        toggleBreakpoint: (file: string, line: number) => Promise<IPCResult>;
        getBreakpoints: (file?: string) => Promise<IPCResult<BreakpointInfo[]>>;
        getVariables: (frameId?: number) => Promise<IPCResult<DebugVariable[]>>;
        evaluate: (expression: string, frameId?: number) => Promise<IPCResult<EvaluateResult>>;
        getSession: (sessionId?: string) => Promise<IPCResult<DebugSessionInfo>>;
        listSessions: () => Promise<IPCResult<DebugSessionInfo[]>>;
      };
      lsp: {
        start: (
          language: string,
          options?: { rootPath?: string },
        ) => Promise<IPCResult & { capabilities?: Record<string, unknown> }>;
        stop: (language: string) => Promise<IPCResult>;
        request: (language: string, method: string, params: unknown) => Promise<IPCResult<unknown>>;
        notify: (language: string, method: string, params: unknown) => Promise<IPCResult>;
        status: (language: string) => Promise<LSPStatus | null>;
        detect: (language: string) => Promise<LSPDetectResult>;
        onNotification: (callback: (data: LSPNotificationData) => void) => () => void;
      };
      index: {
        indexWorkspace: (workspacePath: string) => Promise<IPCResult & { message?: string }>;
        getProgress: () => Promise<IndexProgress>;
        getStats: () => Promise<IndexStats>;
        search: (query: IndexSearchQuery) => Promise<IPCResult<IndexSearchResult>>;
        searchSymbols: (name: string, limit?: number) => Promise<IPCResult<IndexSymbol[]>>;
        getFileSymbols: (filePath: string) => Promise<IPCResult<IndexSymbol[]>>;
        findDefinition: (symbolName: string) => Promise<IPCResult<IndexSymbol>>;
        findReferences: (symbolId: string) => Promise<IPCResult<IndexSymbol[]>>;
        getRelatedCode: (query: string, limit?: number) => Promise<IPCResult<RelatedCodeEntry[]>>;
        cancel: () => Promise<IPCResult>;
        clear: () => Promise<IPCResult>;
        onProgress: (callback: (progress: IndexProgress) => void) => () => void;
        onFileIndexed: (callback: (data: IndexFileEvent) => void) => () => void;
        onComplete: (callback: (stats: IndexCompleteStats) => void) => () => void;
      };
      dashboard: {
        getStats: () => Promise<{
          system: {
            memoryRss: number;
            heapUsed: number;
            heapTotal: number;
            external: number;
            osTotalMem: number;
            osFreeMem: number;
            uptime: number;
            cpuUser: number;
            cpuSystem: number;
            platform: string;
            nodeVersion: string;
          };
          ai: {
            totalRequests: number;
            completedRequests: number;
            failedRequests: number;
            avgLatency: number;
            queueLength: number;
            p50Latency: number;
            p95Latency: number;
            p99Latency: number;
            latencyHistory: number[];
          };
          startup: {
            marks: Record<string, number>;
            measures: Record<string, number>;
            totalMs: number;
          };
          cache: {
            size: number;
            hotPatterns: number;
          };
        }>;
      };
      log: {
        write: (entry: {
          level: string;
          message: string;
          source?: string;
          data?: unknown;
          traceId?: string;
        }) => void;
        getPath: () => Promise<string | null>;
        export: () => Promise<string>;
      };
      plugins: {
        list: () => Promise<MainIPCResult>;
        verify: (pluginId: string) => Promise<MainIPCResult>;
        uninstall: (pluginId: string) => Promise<MainIPCResult>;
        getDir: () => Promise<MainIPCResult<string>>;
      };
    };
  }
}
