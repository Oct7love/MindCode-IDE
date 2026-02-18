/**
 * useCompletion - 代码补全 Hook
 *
 * 提供 Monaco Editor 的 InlineCompletionProvider
 */
import { useState, useCallback, useRef, useEffect } from "react";
import type * as monaco from "monaco-editor";

// ============================================
// 类型定义
// ============================================

export interface CompletionSettings {
  enabled: boolean;
  model: string;
  debounceMs: number;
}

export interface UseCompletionReturn {
  /** 是否启用 */
  enabled: boolean;
  /** 当前模型 */
  model: string;
  /** 是否正在补全 */
  isCompleting: boolean;
  /** 错误信息 */
  error: string | null;
  /** 切换启用状态 */
  toggle: () => void;
  /** 设置模型 */
  setModel: (model: string) => void;
  /** 注册到 Monaco Editor */
  registerProvider: (monacoInstance: typeof monaco) => monaco.IDisposable;
}

// ============================================
// 补全可用模型
// ============================================

export const COMPLETION_MODELS = [
  { id: "deepseek-chat", name: "DeepSeek V3", description: "快速、高性价比" },
  { id: "claude-sonnet-4-5-20250929", name: "Claude Sonnet", description: "高质量" },
  { id: "glm-4.7-flashx", name: "GLM Flash", description: "国产、快速" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", description: "平衡" },
];

// ============================================
// Hook 实现
// ============================================

export function useCompletion(): UseCompletionReturn {
  const [enabled, setEnabled] = useState(true);
  const [model, setModelState] = useState("claude-sonnet-4-5-20250929");
  const [isCompleting, setIsCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debounceMs, setDebounceMs] = useState(150);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  // 加载设置
  useEffect(() => {
    window.mindcode.ai
      .getCompletionSettings()
      .then((settings) => {
        setEnabled(settings.enabled);
        setModelState(settings.model);
        setDebounceMs(settings.debounceMs);
      })
      .catch(console.error);
  }, []);

  // 切换启用状态
  const toggle = useCallback(() => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    window.mindcode.ai.setCompletionSettings({ enabled: newEnabled }).catch(console.error);
  }, [enabled]);

  // 设置模型
  const setModel = useCallback((newModel: string) => {
    setModelState(newModel);
    window.mindcode.ai.setCompletionSettings({ model: newModel }).catch(console.error);
  }, []);

  // 请求补全
  const requestCompletion = useCallback(
    async (
      filePath: string,
      code: string,
      cursorLine: number,
      cursorColumn: number,
    ): Promise<string | null> => {
      // 取消之前的请求
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const currentRequestId = ++requestIdRef.current;

      try {
        setIsCompleting(true);
        setError(null);

        const result = await window.mindcode.ai.completion({
          filePath,
          code,
          cursorLine,
          cursorColumn,
          model,
        });

        // 竞态保护：丢弃过期请求的响应
        if (currentRequestId !== requestIdRef.current) {
          return null;
        }

        if (result.success && result.data) {
          return result.data;
        } else {
          if (result.error) {
            setError(result.error);
          }
          return null;
        }
      } catch (err: unknown) {
        if (currentRequestId !== requestIdRef.current) return null;
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message || "Completion failed");
        }
        return null;
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setIsCompleting(false);
        }
      }
    },
    [model],
  );

  // 注册 Monaco Provider
  const registerProvider = useCallback(
    (monacoInstance: typeof monaco): monaco.IDisposable => {
      console.log("[Completion] Registering InlineCompletionProvider...");
      const disposables: monaco.IDisposable[] = [];

      // 支持的语言
      const languages = [
        "typescript",
        "javascript",
        "python",
        "go",
        "rust",
        "java",
        "c",
        "cpp",
        "csharp",
        "php",
        "ruby",
        "swift",
        "kotlin",
        "scala",
        "html",
        "css",
        "scss",
        "json",
        "yaml",
        "markdown",
        "sql",
        "shell",
        "dockerfile",
        "plaintext",
      ];

      for (const language of languages) {
        const provider = monacoInstance.languages.registerInlineCompletionsProvider(language, {
          provideInlineCompletions: async (
            editorModel: monaco.editor.ITextModel,
            position: monaco.Position,
            context: monaco.languages.InlineCompletionContext,
            token: monaco.CancellationToken,
          ): Promise<monaco.languages.InlineCompletions | null> => {
            console.log("[Completion] provideInlineCompletions called", {
              language,
              line: position.lineNumber,
              enabled,
            });

            // 检查是否取消
            if (token.isCancellationRequested) {
              console.log("[Completion] Cancelled");
              return null;
            }

            // 防抖
            try {
              await new Promise<void>((resolve, reject) => {
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                }
                debounceTimerRef.current = setTimeout(() => {
                  if (token.isCancellationRequested) {
                    reject(new Error("Cancelled"));
                  } else {
                    resolve();
                  }
                }, debounceMs);
              });
            } catch {
              return null;
            }

            if (token.isCancellationRequested) {
              return null;
            }

            // 获取文件路径
            const uri = editorModel.uri;
            const filePath = uri.path || uri.fsPath || "untitled.ts";

            // 获取代码
            const code = editorModel.getValue();
            const cursorLine = position.lineNumber - 1; // 0-based
            const cursorColumn = position.column;

            console.log("[Completion] Requesting completion...", {
              filePath,
              cursorLine,
              cursorColumn,
            });

            // 请求补全
            const completion = await requestCompletion(filePath, code, cursorLine, cursorColumn);

            console.log(
              "[Completion] Got result:",
              completion ? `${completion.length} chars` : "null",
            );

            if (!completion || token.isCancellationRequested) {
              return null;
            }

            return {
              items: [
                {
                  insertText: completion,
                  range: new monacoInstance.Range(
                    position.lineNumber,
                    position.column,
                    position.lineNumber,
                    position.column,
                  ),
                },
              ],
            };
          },

          freeInlineCompletions: () => {
            // 清理资源
          },
        });

        disposables.push(provider);
      }

      console.log("[Completion] Registered for", languages.length, "languages");

      // 返回组合的 disposable
      return {
        dispose: () => {
          console.log("[Completion] Disposing providers...");
          disposables.forEach((d) => d.dispose());
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
        },
      };
    },
    [enabled, debounceMs, requestCompletion],
  );

  return {
    enabled,
    model,
    isCompleting,
    error,
    toggle,
    setModel,
    registerProvider,
  };
}

export default useCompletion;
