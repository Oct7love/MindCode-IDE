/**
 * MindCode Streaming Inline Completion Provider
 * 流式补全 - Ghost Text 逐字显示效果
 *
 * 策略：Monaco InlineCompletionProvider 不支持增量更新，
 * 所以我们用"预取 + re-trigger"模式：
 * 1. 用户输入触发 provideInlineCompletions
 * 2. 启动流式请求，累积 tokens
 * 3. 达到首次显示阈值后返回当前累积文本
 * 4. 后续 tokens 通过 re-trigger 刷新 ghost text
 */

import * as monaco from "monaco-editor";

/** 流式补全状态 */
interface StreamState {
  requestId: string;
  accumulated: string;
  isStreaming: boolean;
  isDone: boolean;
  finalText: string | null;
  cancel: (() => void) | null;
  resolve: ((value: string | null) => void) | null;
  pollTimer: ReturnType<typeof setInterval> | null;
}

// 配置
const FIRST_TOKEN_THRESHOLD = 1;
const REFRESH_INTERVAL_MS = 80;
const MIN_CONTENT_LENGTH = 5;
const DEBOUNCE_MS = 200;
const STREAM_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 30;

// 注释模式检测
const COMMENT_PATTERNS = ["//", "/*", "#", '"""', "'''", "<!--"];

function _shouldUseBlockMode(content: string, lineNumber: number): boolean {
  const lines = content.split("\n");
  if (lineNumber < 1 || lineNumber > lines.length) return false;
  const currentLine = lines[lineNumber - 1] || "";
  const trimmed = currentLine.trimStart();
  if (COMMENT_PATTERNS.some((p) => trimmed.startsWith(p))) return true;
  if (trimmed === "" && lineNumber > 1) {
    const prevLine = lines[lineNumber - 2].trimStart();
    if (COMMENT_PATTERNS.some((p) => prevLine.startsWith(p))) return true;
  }
  if (trimmed === "" && lineNumber > 1) {
    const prevLine = lines[lineNumber - 2].trimEnd();
    if (prevLine.endsWith("{") || prevLine.endsWith(":") || prevLine.endsWith(")")) return true;
  }
  return false;
}

/**
 * 创建流式内联补全提供者
 */
export function createStreamingCompletionProvider(
  getFilePath: () => string,
  editorRef: { current: monaco.editor.IStandaloneCodeEditor | null },
): monaco.languages.InlineCompletionsProvider {
  let currentStream: StreamState | null = null;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let lastTokenCount = 0;

  function cancelCurrentStream() {
    if (currentStream) {
      currentStream.cancel?.();
      currentStream.isStreaming = false;
      currentStream.resolve?.(null);
      if (currentStream.pollTimer) {
        clearInterval(currentStream.pollTimer);
        currentStream.pollTimer = null;
      }
      currentStream = null;
    }
    if (refreshTimer) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    lastTokenCount = 0;
  }

  function startStream(
    filePath: string,
    code: string,
    cursorLine: number,
    cursorColumn: number,
  ): StreamState {
    const state: StreamState = {
      requestId: `sc-${Date.now()}`,
      accumulated: "",
      isStreaming: true,
      isDone: false,
      finalText: null,
      cancel: null,
      resolve: null,
      pollTimer: null,
    };

    const cleanup = window.mindcode.ai.completionStream(
      { filePath, code, cursorLine, cursorColumn },
      {
        onToken: (token: string) => {
          if (!state.isStreaming) return;
          state.accumulated += token;
        },
        onDone: (fullText: string, _cached: boolean) => {
          state.isStreaming = false;
          state.isDone = true;
          state.finalText = fullText;
          state.resolve?.(fullText);
          state.resolve = null;
        },
        onError: (error: string) => {
          console.warn("[StreamCompletion] Error:", error);
          state.isStreaming = false;
          state.isDone = true;
          state.resolve?.(null);
          state.resolve = null;
        },
      },
    );

    state.cancel = cleanup;
    return state;
  }

  return {
    provideInlineCompletions: async (
      model: monaco.editor.ITextModel,
      position: monaco.Position,
      _context: monaco.languages.InlineCompletionContext,
      token: monaco.CancellationToken,
    ): Promise<monaco.languages.InlineCompletions> => {
      const filePath = getFilePath();
      if (!filePath || token.isCancellationRequested) return { items: [] };

      const content = model.getValue();
      if (content.trim().length < MIN_CONTENT_LENGTH) return { items: [] };

      // 取消之前的流
      cancelCurrentStream();

      // 防抖
      try {
        await new Promise<void>((resolve, reject) => {
          debounceTimer = setTimeout(() => {
            if (token.isCancellationRequested) reject(new Error("cancelled"));
            else resolve();
          }, DEBOUNCE_MS);
          token.onCancellationRequested(() => reject(new Error("cancelled")));
        });
      } catch {
        return { items: [] };
      }

      if (token.isCancellationRequested) return { items: [] };

      // 启动流式请求
      const stream = startStream(filePath, content, position.lineNumber - 1, position.column - 1);
      currentStream = stream;

      // 等待首批 token 或完成
      const firstResult = await new Promise<string | null>((resolve) => {
        if (stream.isDone) {
          resolve(stream.finalText);
          return;
        }

        stream.resolve = resolve;

        stream.pollTimer = setInterval(() => {
          if (token.isCancellationRequested || !stream.isStreaming) {
            if (stream.pollTimer) {
              clearInterval(stream.pollTimer);
              stream.pollTimer = null;
            }
            if (!stream.isDone) resolve(null);
            return;
          }
          if (stream.accumulated.length >= FIRST_TOKEN_THRESHOLD) {
            if (stream.pollTimer) {
              clearInterval(stream.pollTimer);
              stream.pollTimer = null;
            }
            stream.resolve = null;
            resolve(stream.accumulated);
          }
        }, POLL_INTERVAL_MS);

        setTimeout(() => {
          if (stream.pollTimer) {
            clearInterval(stream.pollTimer);
            stream.pollTimer = null;
          }
          if (stream.resolve === resolve) {
            stream.resolve = null;
            resolve(stream.accumulated.length > 0 ? stream.accumulated : null);
          }
        }, STREAM_TIMEOUT_MS);
      });

      if (!firstResult || token.isCancellationRequested) return { items: [] };

      const displayText = stream.finalText || firstResult;

      // 流式接收中 → 定时 re-trigger 刷新 ghost text
      if (stream.isStreaming && editorRef.current) {
        lastTokenCount = displayText.length;
        refreshTimer = setInterval(() => {
          if (!stream.isStreaming || !editorRef.current) {
            clearInterval(refreshTimer!);
            refreshTimer = null;
            if (stream.finalText && editorRef.current) {
              editorRef.current.trigger("mindcode", "editor.action.inlineSuggest.trigger", {});
            }
            return;
          }
          if (stream.accumulated.length > lastTokenCount) {
            lastTokenCount = stream.accumulated.length;
            editorRef.current!.trigger("mindcode", "editor.action.inlineSuggest.trigger", {});
          }
        }, REFRESH_INTERVAL_MS);
      }

      // 构建 inline completion item
      const completionLines = displayText.split("\n");
      const endLineNumber = position.lineNumber + completionLines.length - 1;
      const lastLineLength = completionLines[completionLines.length - 1].length;
      const endColumn =
        completionLines.length === 1 ? position.column + lastLineLength : lastLineLength + 1;

      return {
        items: [
          {
            insertText: displayText,
            range: new monaco.Range(position.lineNumber, position.column, endLineNumber, endColumn),
            command: {
              id: "mindcode.streamCompletionAccepted",
              title: "Completion Accepted",
              arguments: [stream.finalText ? "ai-stream" : "ai-stream-partial", 0],
            },
          },
        ],
        enableForwardStability: true,
      };
    },

    freeInlineCompletions: () => {},
  };
}

/**
 * 注册流式补全提供者（多语言）
 */
export function registerStreamingCompletionProvider(
  getFilePath: () => string,
  editorRef: { current: monaco.editor.IStandaloneCodeEditor | null },
  onAccepted?: (source: string) => void,
): monaco.IDisposable {
  const provider = createStreamingCompletionProvider(getFilePath, editorRef);

  // 注册到所有常见语言
  const languages = [
    "typescript",
    "javascript",
    "typescriptreact",
    "javascriptreact",
    "python",
    "java",
    "go",
    "rust",
    "cpp",
    "c",
    "csharp",
    "html",
    "css",
    "json",
    "markdown",
    "yaml",
    "xml",
    "sql",
    "shell",
    "powershell",
    "php",
    "ruby",
    "swift",
    "kotlin",
  ];

  const disposables: monaco.IDisposable[] = languages.map((lang) =>
    monaco.languages.registerInlineCompletionsProvider(lang, provider),
  );

  const cmdDisposable = monaco.editor.registerCommand(
    "mindcode.streamCompletionAccepted",
    (_accessor, source?: string) => {
      console.log(`[StreamCompletion] Accepted: source=${source}`);
      onAccepted?.(source || "unknown");
    },
  );
  disposables.push(cmdDisposable);

  return { dispose: () => disposables.forEach((d) => d.dispose()) };
}
