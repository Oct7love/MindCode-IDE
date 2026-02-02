import { contextBridge, ipcRenderer } from 'electron';

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('mindcode', {
  // 应用信息
  getVersion: () => ipcRenderer.invoke('get-app-version'),

  // AI 服务
  ai: {
    chat: (model: string, messages: any[]) => ipcRenderer.invoke('ai-chat', { model, messages }), // 非流式聊天
    getStats: () => ipcRenderer.invoke('ai-stats'), // 获取 LLM 状态 (队列/熔断)
    // 代码补全
    completion: (request: { filePath: string; code: string; cursorLine: number; cursorColumn: number; model?: string }) => 
      ipcRenderer.invoke('ai:completion', request),
    getCompletionSettings: () => ipcRenderer.invoke('ai:completion-settings'),
    setCompletionSettings: (settings: { enabled?: boolean; model?: string; debounceMs?: number }) => 
      ipcRenderer.invoke('ai:completion-settings-set', settings),
    chatStream: (model: string, messages: any[], callbacks: { onToken: (token: string) => void; onComplete: (fullText: string, meta?: { model: string; usedFallback: boolean }) => void; onError: (error: string, errorType?: string) => void; onFallback?: (from: string, to: string) => void; }) => { // 流式聊天
      const requestId = `stream-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tokenHandler = (_: any, data: { requestId: string; token: string }) => { if (data.requestId === requestId) callbacks.onToken(data.token); };
      const completeHandler = (_: any, data: { requestId: string; fullText: string; model?: string; usedFallback?: boolean }) => { if (data.requestId === requestId) { callbacks.onComplete(data.fullText, { model: data.model || model, usedFallback: data.usedFallback || false }); cleanup(); } };
      const errorHandler = (_: any, data: { requestId: string; error: string; errorType?: string }) => { if (data.requestId === requestId) { callbacks.onError(data.error, data.errorType); cleanup(); } };
      const fallbackHandler = (_: any, data: { requestId: string; from: string; to: string }) => { if (data.requestId === requestId && callbacks.onFallback) callbacks.onFallback(data.from, data.to); };
      const cleanup = () => { ipcRenderer.removeListener('ai-stream-token', tokenHandler); ipcRenderer.removeListener('ai-stream-complete', completeHandler); ipcRenderer.removeListener('ai-stream-error', errorHandler); ipcRenderer.removeListener('ai-stream-fallback', fallbackHandler); };
      ipcRenderer.on('ai-stream-token', tokenHandler);
      ipcRenderer.on('ai-stream-complete', completeHandler);
      ipcRenderer.on('ai-stream-error', errorHandler);
      ipcRenderer.on('ai-stream-fallback', fallbackHandler);
      ipcRenderer.send('ai-chat-stream', { model, messages, requestId });
      return cleanup;
    },
    chatStreamWithTools: (model: string, messages: any[], tools: any[], callbacks: { onToken: (token: string) => void; onToolCall: (calls: any[]) => void; onComplete: (fullText: string, meta?: { model: string; usedFallback: boolean }) => void; onError: (error: string, errorType?: string) => void; onFallback?: (from: string, to: string) => void; }) => { // 流式聊天 + 工具
      const requestId = `stream-tools-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const tokenHandler = (_: any, data: { requestId: string; token: string }) => { if (data.requestId === requestId) callbacks.onToken(data.token); };
      const toolCallHandler = (_: any, data: { requestId: string; toolCalls: any[] }) => { if (data.requestId === requestId) callbacks.onToolCall(data.toolCalls); };
      const completeHandler = (_: any, data: { requestId: string; fullText: string; model?: string; usedFallback?: boolean }) => { if (data.requestId === requestId) { callbacks.onComplete(data.fullText, { model: data.model || model, usedFallback: data.usedFallback || false }); cleanup(); } };
      const errorHandler = (_: any, data: { requestId: string; error: string; errorType?: string }) => { if (data.requestId === requestId) { callbacks.onError(data.error, data.errorType); cleanup(); } };
      const fallbackHandler = (_: any, data: { requestId: string; from: string; to: string }) => { if (data.requestId === requestId && callbacks.onFallback) callbacks.onFallback(data.from, data.to); };
      const cleanup = () => { ipcRenderer.removeListener('ai-stream-token', tokenHandler); ipcRenderer.removeListener('ai-stream-tool-call', toolCallHandler); ipcRenderer.removeListener('ai-stream-complete', completeHandler); ipcRenderer.removeListener('ai-stream-error', errorHandler); ipcRenderer.removeListener('ai-stream-fallback', fallbackHandler); };
      ipcRenderer.on('ai-stream-token', tokenHandler);
      ipcRenderer.on('ai-stream-tool-call', toolCallHandler);
      ipcRenderer.on('ai-stream-complete', completeHandler);
      ipcRenderer.on('ai-stream-error', errorHandler);
      ipcRenderer.on('ai-stream-fallback', fallbackHandler);
      ipcRenderer.send('ai-chat-stream-with-tools', { model, messages, tools, requestId });
      return cleanup;
    }
  },

  // 文件系统操作
  fs: {
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    readDir: (dirPath: string) => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string) =>
      ipcRenderer.invoke('fs:writeFile', filePath, content),
    stat: (filePath: string) => ipcRenderer.invoke('fs:stat', filePath),
    getAllFiles: (workspacePath: string) => ipcRenderer.invoke('fs:getAllFiles', workspacePath),
    searchInFiles: (params: { workspacePath: string; query: string; maxResults?: number }) =>
      ipcRenderer.invoke('fs:searchInFiles', params),
    // 文件管理操作
    createFolder: (folderPath: string) => ipcRenderer.invoke('fs:createFolder', folderPath),
    createFile: (filePath: string, content?: string) =>
      ipcRenderer.invoke('fs:createFile', filePath, content || ''),
    delete: (targetPath: string) => ipcRenderer.invoke('fs:delete', targetPath),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
    copy: (srcPath: string, destPath: string) => ipcRenderer.invoke('fs:copy', srcPath, destPath),
    exists: (targetPath: string) => ipcRenderer.invoke('fs:exists', targetPath),
  },

  // 设置（待实现）
  settings: {
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
  },

  // 终端操作
  terminal: {
    execute: (command: string, cwd?: string) =>
      ipcRenderer.invoke('terminal:execute', command, cwd),
    cd: (currentDir: string, newDir: string) =>
      ipcRenderer.invoke('terminal:cd', currentDir, newDir),
    pwd: () => ipcRenderer.invoke('terminal:pwd'),
  },

  // Git 操作
  git: {
    isRepo: (workspacePath: string) => ipcRenderer.invoke('git:isRepo', workspacePath),
    status: (workspacePath: string) => ipcRenderer.invoke('git:status', workspacePath),
    currentBranch: (workspacePath: string) => ipcRenderer.invoke('git:currentBranch', workspacePath),
    branches: (workspacePath: string) => ipcRenderer.invoke('git:branches', workspacePath),
    stage: (workspacePath: string, filePaths: string[]) => ipcRenderer.invoke('git:stage', workspacePath, filePaths),
    unstage: (workspacePath: string, filePaths: string[]) => ipcRenderer.invoke('git:unstage', workspacePath, filePaths),
    commit: (workspacePath: string, message: string) => ipcRenderer.invoke('git:commit', workspacePath, message),
    diff: (workspacePath: string, filePath: string, staged?: boolean) => ipcRenderer.invoke('git:diff', workspacePath, filePath, staged || false),
    checkout: (workspacePath: string, branchName: string) => ipcRenderer.invoke('git:checkout', workspacePath, branchName),
    createBranch: (workspacePath: string, branchName: string) => ipcRenderer.invoke('git:createBranch', workspacePath, branchName),
    log: (workspacePath: string, limit?: number) => ipcRenderer.invoke('git:log', workspacePath, limit || 50),
    discard: (workspacePath: string, filePath: string) => ipcRenderer.invoke('git:discard', workspacePath, filePath),
  },

  // 菜单事件监听
  onMenuEvent: (callback: (event: string, data?: any) => void) => {
    const events = [
      'menu:newFile', 'menu:openFile', 'menu:openFolder', 'menu:save', 'menu:saveAs',
      'menu:closeEditor', 'menu:find', 'menu:findInFiles', 'menu:replace',
      'menu:commandPalette', 'menu:showExplorer', 'menu:showSearch', 'menu:showGit',
      'menu:toggleTerminal', 'menu:toggleAI', 'menu:goToFile', 'menu:goToLine', 'menu:newTerminal'
    ];
    const handlers: { [key: string]: (...args: any[]) => void } = {};
    events.forEach(event => {
      handlers[event] = (_: any, data: any) => callback(event, data);
      ipcRenderer.on(event, handlers[event]);
    });
    // 返回清理函数
    return () => {
      events.forEach(event => {
        ipcRenderer.removeListener(event, handlers[event]);
      });
    };
  },

  // 主题切换监听
  onThemeChange: (callback: (themeId: string) => void) => {
    const handler = (_: any, themeId: string) => callback(themeId);
    ipcRenderer.on('theme:change', handler);
    return () => {
      ipcRenderer.removeListener('theme:change', handler);
    };
  },

  // 文件系统变更监听
  onFileSystemChange: (callback: (data: { filePath: string; type: string }) => void) => {
    const handler = (_: any, data: { filePath: string; type: string }) => callback(data);
    ipcRenderer.on('fs:fileChanged', handler);
    return () => {
      ipcRenderer.removeListener('fs:fileChanged', handler);
    };
  },

  // 对话框
  dialog: {
    showSaveDialog: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:showSaveDialog', options),
    showOpenDialog: (options: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) =>
      ipcRenderer.invoke('dialog:showOpenDialog', options),
    showMessageBox: (options: { type?: string; title?: string; message: string; buttons?: string[] }) =>
      ipcRenderer.invoke('dialog:showMessageBox', options),
  },

  // 代码索引服务
  index: {
    // 索引整个工作区
    indexWorkspace: (workspacePath: string) => ipcRenderer.invoke('index:indexWorkspace', workspacePath),
    // 获取索引进度
    getProgress: () => ipcRenderer.invoke('index:getProgress'),
    // 获取索引统计
    getStats: () => ipcRenderer.invoke('index:getStats'),
    // 搜索代码
    search: (query: { query: string; type?: string; limit?: number; fileFilter?: string[]; kindFilter?: string[] }) =>
      ipcRenderer.invoke('index:search', query),
    // 搜索符号
    searchSymbols: (name: string, limit?: number) => ipcRenderer.invoke('index:searchSymbols', name, limit),
    // 获取文件符号（大纲）
    getFileSymbols: (filePath: string) => ipcRenderer.invoke('index:getFileSymbols', filePath),
    // 查找定义
    findDefinition: (symbolName: string) => ipcRenderer.invoke('index:findDefinition', symbolName),
    // 查找引用
    findReferences: (symbolId: string) => ipcRenderer.invoke('index:findReferences', symbolId),
    // 获取相关代码（用于 @codebase）
    getRelatedCode: (query: string, limit?: number) => ipcRenderer.invoke('index:getRelatedCode', query, limit),
    // 取消索引
    cancel: () => ipcRenderer.invoke('index:cancel'),
    // 清空索引
    clear: () => ipcRenderer.invoke('index:clear'),
    // 监听索引进度
    onProgress: (callback: (progress: any) => void) => {
      const handler = (_: any, progress: any) => callback(progress);
      ipcRenderer.on('index:progress', handler);
      return () => ipcRenderer.removeListener('index:progress', handler);
    },
    // 监听文件索引完成
    onFileIndexed: (callback: (data: { filePath: string; symbolCount: number }) => void) => {
      const handler = (_: any, data: { filePath: string; symbolCount: number }) => callback(data);
      ipcRenderer.on('index:fileIndexed', handler);
      return () => ipcRenderer.removeListener('index:fileIndexed', handler);
    },
    // 监听索引完成
    onComplete: (callback: (stats: { files: number; symbols: number; time: number }) => void) => {
      const handler = (_: any, stats: { files: number; symbols: number; time: number }) => callback(stats);
      ipcRenderer.on('index:complete', handler);
      return () => ipcRenderer.removeListener('index:complete', handler);
    },
  }
});

// 类型声明
declare global {
  interface Window {
    mindcode: {
      getVersion: () => Promise<string>;
      ai: {
        chat: (model: string, messages: any[]) => Promise<{ success: boolean; data?: string; error?: string; errorType?: string; model?: string; usedFallback?: boolean }>;
        getStats: () => Promise<{ queue: Record<string, { running: number; queued: number }>; breakers: Record<string, { open: boolean; failCount: number }> }>;
        chatStream: (model: string, messages: any[], callbacks: { onToken: (token: string) => void; onComplete: (fullText: string, meta?: { model: string; usedFallback: boolean }) => void; onError: (error: string, errorType?: string) => void; onFallback?: (from: string, to: string) => void; }) => () => void;
        chatStreamWithTools: (model: string, messages: any[], tools: any[], callbacks: { onToken: (token: string) => void; onToolCall: (calls: any[]) => void; onComplete: (fullText: string, meta?: { model: string; usedFallback: boolean }) => void; onError: (error: string, errorType?: string) => void; onFallback?: (from: string, to: string) => void; }) => () => void;
        // 代码补全
        completion: (request: { filePath: string; code: string; cursorLine: number; cursorColumn: number; model?: string }) => Promise<{ success: boolean; data?: string; error?: string; cached?: boolean }>;
        getCompletionSettings: () => Promise<{ enabled: boolean; model: string; debounceMs: number }>;
        setCompletionSettings: (settings: { enabled?: boolean; model?: string; debounceMs?: number }) => Promise<{ success: boolean }>;
      };
      fs: {
        openFolder: () => Promise<string | null>;
        readDir: (dirPath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
        writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
        stat: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        getAllFiles: (workspacePath: string) => Promise<{
          success: boolean;
          data?: Array<{ name: string; path: string; relativePath: string }>;
          error?: string;
        }>;
        searchInFiles: (params: { workspacePath: string; query: string; maxResults?: number }) => Promise<{
          success: boolean;
          data?: Array<{
            file: string;
            relativePath: string;
            line: number;
            column: number;
            text: string;
            matchStart: number;
            matchEnd: number;
          }>;
          error?: string;
        }>;
        // 文件管理操作
        createFolder: (folderPath: string) => Promise<{ success: boolean; error?: string }>;
        createFile: (filePath: string, content?: string) => Promise<{ success: boolean; error?: string }>;
        delete: (targetPath: string) => Promise<{ success: boolean; error?: string }>;
        rename: (oldPath: string, newPath: string) => Promise<{ success: boolean; error?: string }>;
        copy: (srcPath: string, destPath: string) => Promise<{ success: boolean; error?: string }>;
        exists: (targetPath: string) => Promise<{ success: boolean; data?: boolean; error?: string }>;
      };
      settings: {
        get: (key: string) => Promise<any>;
        set: (key: string, value: any) => Promise<void>;
      };
      terminal: {
        execute: (command: string, cwd?: string) => Promise<{
          success: boolean;
          data?: { stdout: string; stderr: string };
          error?: string;
        }>;
        cd: (currentDir: string, newDir: string) => Promise<{
          success: boolean;
          data?: string;
          error?: string;
        }>;
        pwd: () => Promise<{ success: boolean; data?: string; error?: string }>;
      };
      git: {
        isRepo: (workspacePath: string) => Promise<{ success: boolean; data?: boolean; error?: string }>;
        status: (workspacePath: string) => Promise<{
          success: boolean;
          data?: Array<{ path: string; status: string; staged: boolean }>;
          error?: string;
        }>;
        currentBranch: (workspacePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
        branches: (workspacePath: string) => Promise<{
          success: boolean;
          data?: Array<{ name: string; current: boolean }>;
          error?: string;
        }>;
        stage: (workspacePath: string, filePaths: string[]) => Promise<{ success: boolean; error?: string }>;
        unstage: (workspacePath: string, filePaths: string[]) => Promise<{ success: boolean; error?: string }>;
        commit: (workspacePath: string, message: string) => Promise<{ success: boolean; error?: string }>;
        diff: (workspacePath: string, filePath: string, staged?: boolean) => Promise<{ success: boolean; data?: string; error?: string }>;
        checkout: (workspacePath: string, branchName: string) => Promise<{ success: boolean; error?: string }>;
        createBranch: (workspacePath: string, branchName: string) => Promise<{ success: boolean; error?: string }>;
        log: (workspacePath: string, limit?: number) => Promise<{
          success: boolean;
          data?: Array<{ hash: string; shortHash: string; author: string; email: string; date: string; message: string }>;
          error?: string;
        }>;
        discard: (workspacePath: string, filePath: string) => Promise<{ success: boolean; error?: string }>;
      };
      onMenuEvent: (callback: (event: string, data?: any) => void) => () => void;
      onThemeChange: (callback: (themeId: string) => void) => () => void;
      onFileSystemChange: (callback: (data: { filePath: string; type: string }) => void) => () => void;
      dialog: {
        showSaveDialog: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath?: string }>;
        showOpenDialog: (options: { filters?: { name: string; extensions: string[] }[]; properties?: string[] }) => Promise<{ canceled: boolean; filePaths?: string[] }>;
        showMessageBox: (options: { type?: string; title?: string; message: string; buttons?: string[] }) => Promise<{ response: number }>;
      };
      // 代码索引服务
      index: {
        indexWorkspace: (workspacePath: string) => Promise<{ success: boolean; message?: string; error?: string }>;
        getProgress: () => Promise<{ status: string; totalFiles: number; indexedFiles: number; currentFile?: string }>;
        getStats: () => Promise<{ totalFiles: number; totalSymbols: number; totalCallRelations: number; totalDependencies: number; totalChunks: number }>;
        search: (query: { query: string; type?: string; limit?: number; fileFilter?: string[]; kindFilter?: string[] }) => Promise<{
          success: boolean;
          data?: {
            items: Array<{
              item: any;
              score: number;
              matchType: string;
              highlights?: string[];
              context?: string;
            }>;
            totalCount: number;
            timeTaken: number;
            hasMore: boolean;
          };
          error?: string;
        }>;
        searchSymbols: (name: string, limit?: number) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getFileSymbols: (filePath: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        findDefinition: (symbolName: string) => Promise<{ success: boolean; data?: any; error?: string }>;
        findReferences: (symbolId: string) => Promise<{ success: boolean; data?: any[]; error?: string }>;
        getRelatedCode: (query: string, limit?: number) => Promise<{ success: boolean; data?: Array<{ filePath: string; code: string; relevance: number }>; error?: string }>;
        cancel: () => Promise<{ success: boolean; error?: string }>;
        clear: () => Promise<{ success: boolean; error?: string }>;
        onProgress: (callback: (progress: any) => void) => () => void;
        onFileIndexed: (callback: (data: { filePath: string; symbolCount: number }) => void) => () => void;
        onComplete: (callback: (stats: { files: number; symbols: number; time: number }) => void) => () => void;
      };
    };
  }
}
