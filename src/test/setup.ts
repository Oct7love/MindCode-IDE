/**
 * Test Setup - 测试环境配置
 * 包含完整的 window.mindcode API mock
 */

import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi
  .fn()
  .mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));

// Mock IntersectionObserver
global.IntersectionObserver = vi
  .fn()
  .mockImplementation(() => ({ observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() }));

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

// ─── 工具函数：IPCResult mock ───
function mockIPCResult<T>(data?: T) {
  return { success: true, data };
}

// ─── window.mindcode 完整 API Mock ───
const mindcodeMock = {
  getVersion: vi.fn().mockResolvedValue("1.0.0-test"),

  ai: {
    chat: vi.fn().mockResolvedValue(mockIPCResult("AI 回复")),
    getStats: vi.fn().mockResolvedValue(mockIPCResult({ totalTokens: 0, totalCost: 0 })),
    completion: vi.fn().mockResolvedValue(mockIPCResult({ text: "", cached: false })),
    getCompletionSettings: vi
      .fn()
      .mockResolvedValue({ enabled: true, model: "gpt-4o", debounceMs: 300 }),
    setCompletionSettings: vi.fn().mockResolvedValue(undefined),
    completionStream: vi.fn().mockReturnValue(() => {}),
    chatStream: vi.fn().mockReturnValue(() => {}),
    chatStreamWithTools: vi.fn().mockReturnValue(() => {}),
  },

  fs: {
    openFolder: vi.fn().mockResolvedValue(null),
    readDir: vi.fn().mockResolvedValue(mockIPCResult([])),
    readFile: vi.fn().mockResolvedValue(mockIPCResult("")),
    readFileChunk: vi.fn().mockResolvedValue(mockIPCResult({ lines: [], totalLines: 0 })),
    getLineCount: vi.fn().mockResolvedValue(mockIPCResult(0)),
    writeFile: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    stat: vi
      .fn()
      .mockResolvedValue(
        mockIPCResult({
          size: 0,
          isFile: true,
          isDirectory: false,
          modified: Date.now(),
          created: Date.now(),
        }),
      ),
    getEncodings: vi.fn().mockResolvedValue([]),
    detectEncoding: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    getAllFiles: vi.fn().mockResolvedValue(mockIPCResult([])),
    searchInFiles: vi.fn().mockResolvedValue(mockIPCResult([])),
    createFolder: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    createFile: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    delete: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    rename: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    copy: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    exists: vi.fn().mockResolvedValue(mockIPCResult(true)),
  },

  settings: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },

  terminal: {
    execute: vi.fn().mockResolvedValue(mockIPCResult({ stdout: "", stderr: "", exitCode: 0 })),
    cd: vi.fn().mockResolvedValue(mockIPCResult("/home")),
    pwd: vi.fn().mockResolvedValue(mockIPCResult("/home")),
    create: vi.fn().mockResolvedValue({ ...mockIPCResult(undefined), id: "term-1" }),
    write: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    resize: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    close: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    onData: vi.fn().mockReturnValue(() => {}),
    onExit: vi.fn().mockReturnValue(() => {}),
  },

  git: {
    isRepo: vi.fn().mockResolvedValue(mockIPCResult(false)),
    status: vi.fn().mockResolvedValue(mockIPCResult([])),
    currentBranch: vi.fn().mockResolvedValue(mockIPCResult("main")),
    branches: vi.fn().mockResolvedValue(mockIPCResult([])),
    stage: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    unstage: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    commit: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    diff: vi.fn().mockResolvedValue(mockIPCResult("")),
    checkout: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    createBranch: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    log: vi.fn().mockResolvedValue(mockIPCResult([])),
    discard: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
  },

  onMenuEvent: vi.fn().mockReturnValue(() => {}),
  onThemeChange: vi.fn().mockReturnValue(() => {}),
  onFileSystemChange: vi.fn().mockReturnValue(() => {}),

  dialog: {
    showSaveDialog: vi.fn().mockResolvedValue(null),
    showOpenDialog: vi.fn().mockResolvedValue(null),
    showMessageBox: vi.fn().mockResolvedValue({ response: 0 }),
  },

  lsp: {
    start: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    stop: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    request: vi.fn().mockResolvedValue(null),
    notify: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockResolvedValue(null),
    detect: vi.fn().mockResolvedValue(mockIPCResult(false)),
    onNotification: vi.fn().mockReturnValue(() => {}),
  },

  debug: {
    start: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    stop: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    continue: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    stepOver: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    stepInto: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    stepOut: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    pause: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    restart: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    addBreakpoint: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    removeBreakpoint: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    toggleBreakpoint: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    getBreakpoints: vi.fn().mockResolvedValue(mockIPCResult([])),
    getVariables: vi.fn().mockResolvedValue(mockIPCResult([])),
    evaluate: vi.fn().mockResolvedValue(mockIPCResult({ result: "" })),
    getSession: vi.fn().mockResolvedValue(mockIPCResult(null)),
    listSessions: vi.fn().mockResolvedValue(mockIPCResult([])),
  },

  index: {
    indexWorkspace: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    getProgress: vi
      .fn()
      .mockResolvedValue(mockIPCResult({ status: "idle", totalFiles: 0, indexedFiles: 0 })),
    getStats: vi
      .fn()
      .mockResolvedValue({
        totalFiles: 0,
        totalSymbols: 0,
        totalCallRelations: 0,
        totalDependencies: 0,
        totalChunks: 0,
      }),
    search: vi
      .fn()
      .mockResolvedValue(mockIPCResult({ items: [], totalCount: 0, timeTaken: 0, hasMore: false })),
    searchSymbols: vi.fn().mockResolvedValue(mockIPCResult([])),
    getFileSymbols: vi.fn().mockResolvedValue(mockIPCResult([])),
    findDefinition: vi.fn().mockResolvedValue(mockIPCResult(null)),
    findReferences: vi.fn().mockResolvedValue(mockIPCResult([])),
    getRelatedCode: vi.fn().mockResolvedValue(mockIPCResult([])),
    cancel: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    clear: vi.fn().mockResolvedValue(mockIPCResult(undefined)),
    onProgress: vi.fn().mockReturnValue(() => {}),
    onFileIndexed: vi.fn().mockReturnValue(() => {}),
    onComplete: vi.fn().mockReturnValue(() => {}),
  },
};

Object.defineProperty(window, "mindcode", {
  value: mindcodeMock,
  writable: true,
  configurable: true,
});

Object.defineProperty(window, "electronAPI", {
  value: {
    minimizeWindow: vi.fn(),
    maximizeWindow: vi.fn().mockResolvedValue(undefined),
    closeWindow: vi.fn(),
    isMaximized: vi.fn().mockResolvedValue(false),
    showAppMenu: vi.fn(),
  },
  writable: true,
  configurable: true,
});

// Mock Electron IPC（兼容旧代码）
(window as unknown as Record<string, unknown>).electron = {
  invoke: vi.fn().mockResolvedValue(null),
  on: vi.fn().mockReturnValue(() => {}),
  send: vi.fn(),
};

// Mock Monaco Editor
vi.mock("monaco-editor", () => ({
  editor: { create: vi.fn(), createModel: vi.fn(), setTheme: vi.fn() },
  languages: { register: vi.fn(), setMonarchTokensProvider: vi.fn() },
}));

// 导出 mock 以便测试中使用
export { mindcodeMock, localStorageMock, mockIPCResult };

// 清理
afterEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});
