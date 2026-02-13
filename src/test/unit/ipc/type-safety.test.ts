import { describe, it, expect } from "vitest";
import type {
  IPCResult,
  SettingValue,
  FileEntry,
  FileStat,
  GitFileStatus,
  GitBranch,
  BreakpointInfo,
  DebugSessionInfo,
  MenuEvent,
  StreamTokenData,
  StreamCompleteData,
  StreamErrorData,
  ChatStreamCallbacks,
  ChatStreamWithToolsCallbacks,
  CompletionStreamCallbacks,
  IndexProgress,
  IndexSearchQuery,
  TerminalDataEvent,
  TerminalExitEvent,
  LSPNotificationData,
  IPCInvokeChannelMap,
  IPCEventChannelMap,
} from "@shared/types/ipc";

describe("IPC 类型安全", () => {
  describe("IPCResult 泛型", () => {
    it("应正确携带泛型数据", () => {
      const result: IPCResult<string> = { success: true, data: "hello" };
      expect(result.success).toBe(true);
      expect(result.data).toBe("hello");
    });

    it("错误结果应包含 error 字段", () => {
      const result: IPCResult = { success: false, error: "操作失败" };
      expect(result.success).toBe(false);
      expect(result.error).toBe("操作失败");
    });

    it("应支持复杂泛型", () => {
      const result: IPCResult<FileEntry[]> = {
        success: true,
        data: [
          {
            name: "test.ts",
            path: "/src/test.ts",
            type: "file",
            isDirectory: false,
            isFile: true,
            size: 100,
            extension: ".ts",
          },
        ],
      };
      expect(result.data).toHaveLength(1);
      expect(result.data![0].type).toBe("file");
    });
  });

  describe("SettingValue 联合类型", () => {
    it("应接受 string", () => {
      const v: SettingValue = "dark";
      expect(typeof v).toBe("string");
    });
    it("应接受 number", () => {
      const v: SettingValue = 42;
      expect(typeof v).toBe("number");
    });
    it("应接受 boolean", () => {
      const v: SettingValue = true;
      expect(typeof v).toBe("boolean");
    });
    it("应接受 null", () => {
      const v: SettingValue = null;
      expect(v).toBeNull();
    });
    it("应接受 Record<string, unknown>", () => {
      const v: SettingValue = { theme: "dark", fontSize: 14 };
      expect(typeof v).toBe("object");
    });
  });

  describe("FileEntry 结构", () => {
    it("应包含所有必需字段", () => {
      const entry: FileEntry = {
        name: "index.ts",
        path: "/src/index.ts",
        type: "file",
        isDirectory: false,
        isFile: true,
        size: 2048,
        extension: ".ts",
      };
      expect(entry.name).toBe("index.ts");
      expect(entry.type).toBe("file");
      expect(entry.isFile).toBe(true);
      expect(entry.isDirectory).toBe(false);
    });
    it("folder 类型应标记 isDirectory", () => {
      const entry: FileEntry = {
        name: "src",
        path: "/src",
        type: "folder",
        isDirectory: true,
        isFile: false,
        size: 4096,
        extension: "",
      };
      expect(entry.type).toBe("folder");
      expect(entry.isDirectory).toBe(true);
    });
  });

  describe("FileStat 结构", () => {
    it("应包含所有必需字段", () => {
      const stat: FileStat = {
        size: 1024,
        isFile: true,
        isDirectory: false,
        modifiedAt: Date.now(),
        createdAt: Date.now() - 86400000,
      };
      expect(stat.size).toBe(1024);
      expect(stat.isFile).toBe(true);
      expect(stat.modifiedAt).toBeGreaterThan(stat.createdAt);
    });
  });

  describe("Git 类型", () => {
    it("GitFileStatus 结构正确", () => {
      const status: GitFileStatus = { path: "src/index.ts", status: "modified", staged: false };
      expect(status.staged).toBe(false);
      expect(status.path).toBe("src/index.ts");
    });
    it("GitBranch 结构正确", () => {
      const branch: GitBranch = { name: "main", current: true };
      expect(branch.current).toBe(true);
      expect(branch.name).toBe("main");
    });
  });

  describe("调试器类型", () => {
    it("BreakpointInfo 包含所有必需字段", () => {
      const bp: BreakpointInfo = {
        id: "bp-1",
        file: "test.ts",
        line: 10,
        verified: true,
        enabled: true,
      };
      expect(bp.enabled).toBe(true);
      expect(bp.verified).toBe(true);
    });

    it("BreakpointInfo 支持可选字段", () => {
      const bp: BreakpointInfo = {
        id: "bp-2",
        file: "test.ts",
        line: 20,
        column: 5,
        verified: false,
        enabled: true,
        condition: "x > 10",
        hitCondition: "3",
        logMessage: "hit breakpoint",
      };
      expect(bp.condition).toBe("x > 10");
    });

    it("DebugSessionInfo 结构正确", () => {
      const session: DebugSessionInfo = {
        id: "session-1",
        name: "Debug Test",
        type: "node",
        config: {
          name: "Debug Test",
          type: "node",
          request: "launch",
          program: "index.js",
        },
        state: "running",
        breakpoints: [
          {
            id: "bp-1",
            file: "index.js",
            line: 5,
            verified: true,
            enabled: true,
          },
        ],
        stackFrames: [
          {
            id: 1,
            name: "main",
            file: "index.js",
            line: 5,
            column: 1,
          },
        ],
        variables: [
          {
            name: "x",
            value: "42",
            type: "number",
            variablesReference: 0,
          },
        ],
      };
      expect(session.state).toBe("running");
      expect(session.breakpoints).toHaveLength(1);
      expect(session.stackFrames).toHaveLength(1);
      expect(session.variables).toHaveLength(1);
    });

    it("DebugSessionInfo.state 只接受合法值", () => {
      const states: DebugSessionInfo["state"][] = ["inactive", "running", "paused", "stopped"];
      expect(states).toHaveLength(4);
    });
  });

  describe("MenuEvent 联合类型", () => {
    it("应包含所有菜单事件", () => {
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
      expect(events).toHaveLength(18);
    });
  });

  describe("Stream 回调类型", () => {
    it("StreamTokenData 包含 requestId 和 token", () => {
      const data: StreamTokenData = { requestId: "req-1", token: "hello" };
      expect(data.requestId).toBeDefined();
      expect(data.token).toBeDefined();
    });
    it("StreamCompleteData 包含 fullText", () => {
      const data: StreamCompleteData = { requestId: "req-1", fullText: "完整内容" };
      expect(data.fullText).toBe("完整内容");
    });
    it("StreamCompleteData 支持可选的 model 和 usedFallback", () => {
      const data: StreamCompleteData = {
        requestId: "req-1",
        fullText: "内容",
        model: "gpt-4",
        usedFallback: false,
      };
      expect(data.model).toBe("gpt-4");
    });
    it("StreamErrorData 包含 error", () => {
      const data: StreamErrorData = { requestId: "req-1", error: "超时" };
      expect(data.error).toBe("超时");
    });
    it("StreamErrorData 支持可选的 errorType", () => {
      const data: StreamErrorData = { requestId: "req-1", error: "超时", errorType: "TIMEOUT" };
      expect(data.errorType).toBe("TIMEOUT");
    });
  });

  describe("回调接口类型", () => {
    it("ChatStreamCallbacks 结构正确", () => {
      const callbacks: ChatStreamCallbacks = {
        onToken: (_token: string) => {},
        onComplete: (_fullText: string, _meta?: { model: string; usedFallback: boolean }) => {},
        onError: (_error: string, _errorType?: string) => {},
      };
      expect(callbacks.onToken).toBeDefined();
      expect(callbacks.onComplete).toBeDefined();
      expect(callbacks.onError).toBeDefined();
      expect(callbacks.onFallback).toBeUndefined();
    });

    it("ChatStreamWithToolsCallbacks 继承 ChatStreamCallbacks 并添加 onToolCall", () => {
      const callbacks: ChatStreamWithToolsCallbacks = {
        onToken: () => {},
        onComplete: () => {},
        onError: () => {},
        onToolCall: () => {},
      };
      expect(callbacks.onToolCall).toBeDefined();
    });

    it("CompletionStreamCallbacks 包含 onToken/onDone/onError", () => {
      const callbacks: CompletionStreamCallbacks = {
        onToken: () => {},
        onDone: (_fullText: string, _cached: boolean) => {},
        onError: () => {},
      };
      expect(callbacks.onDone).toBeDefined();
    });
  });

  describe("Index 类型", () => {
    it("IndexProgress 结构正确", () => {
      const progress: IndexProgress = {
        status: "indexing",
        totalFiles: 100,
        indexedFiles: 50,
        currentFile: "src/index.ts",
      };
      expect(progress.status).toBe("indexing");
      expect(progress.indexedFiles).toBeLessThan(progress.totalFiles);
    });

    it("IndexProgress 的 currentFile 是可选的", () => {
      const progress: IndexProgress = {
        status: "complete",
        totalFiles: 100,
        indexedFiles: 100,
      };
      expect(progress.currentFile).toBeUndefined();
    });

    it("IndexSearchQuery 结构正确", () => {
      const query: IndexSearchQuery = {
        query: "function",
        type: "symbol",
        limit: 20,
        fileFilter: ["*.ts"],
        kindFilter: ["function"],
      };
      expect(query.query).toBe("function");
    });

    it("IndexSearchQuery 可选字段可省略", () => {
      const query: IndexSearchQuery = { query: "test" };
      expect(query.type).toBeUndefined();
    });
  });

  describe("终端类型", () => {
    it("TerminalDataEvent 包含 id 和 data", () => {
      const event: TerminalDataEvent = { id: "term-1", data: "output" };
      expect(event.id).toBe("term-1");
      expect(event.data).toBe("output");
    });
    it("TerminalExitEvent 包含 id 和 exitCode", () => {
      const event: TerminalExitEvent = { id: "term-1", exitCode: 0 };
      expect(event.exitCode).toBe(0);
    });
  });

  describe("LSP 类型", () => {
    it("LSPNotificationData 结构正确", () => {
      const data: LSPNotificationData = {
        language: "typescript",
        method: "textDocument/publishDiagnostics",
        params: {},
      };
      expect(data.language).toBe("typescript");
      expect(data.method).toBe("textDocument/publishDiagnostics");
    });
  });

  describe("Channel 映射类型", () => {
    it("IPCInvokeChannelMap 包含所有模块通道", () => {
      // 编译期验证：如果任何 channel key 不存在，TS 会报错
      type AssertChannel<K extends keyof IPCInvokeChannelMap> = K;
      type _App = AssertChannel<"get-app-version">;
      type _AI = AssertChannel<"ai-chat">;
      type _FS = AssertChannel<"fs:readDir">;
      type _Settings = AssertChannel<"settings:get">;
      type _Terminal = AssertChannel<"terminal:create">;
      type _Git = AssertChannel<"git:status">;
      type _Dialog = AssertChannel<"dialog:showSaveDialog">;
      type _LSP = AssertChannel<"lsp:start">;
      type _Debug = AssertChannel<"debug:start">;
      type _Index = AssertChannel<"index:search">;

      // 消除未使用类型警告
      const _: [_App, _AI, _FS, _Settings, _Terminal, _Git, _Dialog, _LSP, _Debug, _Index] = [
        "get-app-version",
        "ai-chat",
        "fs:readDir",
        "settings:get",
        "terminal:create",
        "git:status",
        "dialog:showSaveDialog",
        "lsp:start",
        "debug:start",
        "index:search",
      ];
      expect(_).toHaveLength(10);
    });

    it("IPCEventChannelMap 包含所有事件通道", () => {
      type AssertEvent<K extends keyof IPCEventChannelMap> = K;
      type _StreamToken = AssertEvent<"ai-stream-token">;
      type _StreamComplete = AssertEvent<"ai-stream-complete">;
      type _StreamError = AssertEvent<"ai-stream-error">;
      type _TermData = AssertEvent<"terminal:data">;
      type _TermExit = AssertEvent<"terminal:exit">;
      type _LSPNotify = AssertEvent<"lsp:notification">;
      type _IndexProg = AssertEvent<"index:progress">;

      const _: [
        _StreamToken,
        _StreamComplete,
        _StreamError,
        _TermData,
        _TermExit,
        _LSPNotify,
        _IndexProg,
      ] = [
        "ai-stream-token",
        "ai-stream-complete",
        "ai-stream-error",
        "terminal:data",
        "terminal:exit",
        "lsp:notification",
        "index:progress",
      ];
      expect(_).toHaveLength(7);
    });
  });
});
