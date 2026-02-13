/**
 * useCopyWithFeedback - 复制功能 Hook
 *
 * 集成复制逻辑与反馈状态管理
 */
import { useState, useCallback, useRef } from "react";
import type { CopyFormat, CopyResult } from "../utils/copyService";
import { copyToClipboard, copyMessage, copyCode, copyAllCodeBlocks } from "../utils/copyService";

// ============================================
// 类型定义
// ============================================

export type CopyState = "idle" | "copying" | "success" | "error";

export interface CopyFeedback {
  show: boolean;
  message: string;
  type: "success" | "error";
}

export interface UseCopyWithFeedbackReturn {
  /** 当前复制状态 */
  copyState: CopyState;
  /** Toast 反馈状态 */
  feedback: CopyFeedback;
  /** 复制消息内容 */
  copyMessageContent: (content: string, format?: CopyFormat) => Promise<boolean>;
  /** 复制代码 */
  copyCodeContent: (code: string) => Promise<boolean>;
  /** 复制所有代码块 */
  copyAllCode: (markdown: string) => Promise<boolean>;
  /** 复制任意文本 */
  copyText: (text: string) => Promise<boolean>;
  /** 隐藏反馈 */
  hideFeedback: () => void;
  /** 重置状态 */
  reset: () => void;
}

// ============================================
// Hook 实现
// ============================================

export function useCopyWithFeedback(
  successDuration: number = 1200,
  feedbackDuration: number = 2000,
): UseCopyWithFeedbackReturn {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [feedback, setFeedback] = useState<CopyFeedback>({
    show: false,
    message: "",
    type: "success",
  });

  const stateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 清理定时器
  const clearTimers = useCallback(() => {
    if (stateTimeoutRef.current) {
      clearTimeout(stateTimeoutRef.current);
      stateTimeoutRef.current = null;
    }
    if (feedbackTimeoutRef.current) {
      clearTimeout(feedbackTimeoutRef.current);
      feedbackTimeoutRef.current = null;
    }
  }, []);

  // 处理复制结果
  const handleCopyResult = useCallback(
    (result: CopyResult, successMessage: string = "已复制到剪贴板"): boolean => {
      clearTimers();

      if (result.success) {
        setCopyState("success");
        setFeedback({
          show: true,
          message: successMessage,
          type: "success",
        });

        stateTimeoutRef.current = setTimeout(() => {
          setCopyState("idle");
        }, successDuration);

        feedbackTimeoutRef.current = setTimeout(() => {
          setFeedback((prev) => ({ ...prev, show: false }));
        }, feedbackDuration);

        return true;
      } else {
        setCopyState("error");
        setFeedback({
          show: true,
          message: result.error || "复制失败",
          type: "error",
        });

        stateTimeoutRef.current = setTimeout(() => {
          setCopyState("idle");
        }, 1500);

        feedbackTimeoutRef.current = setTimeout(() => {
          setFeedback((prev) => ({ ...prev, show: false }));
        }, feedbackDuration);

        return false;
      }
    },
    [clearTimers, successDuration, feedbackDuration],
  );

  // 复制消息内容
  const copyMessageContent = useCallback(
    async (content: string, format: CopyFormat = "markdown"): Promise<boolean> => {
      setCopyState("copying");
      const result = await copyMessage(content, format);
      const formatLabel = format === "plaintext" ? "纯文本" : "Markdown";
      return handleCopyResult(result, `已复制${formatLabel}到剪贴板`);
    },
    [handleCopyResult],
  );

  // 复制代码
  const copyCodeContent = useCallback(
    async (code: string): Promise<boolean> => {
      setCopyState("copying");
      const result = await copyCode(code);
      return handleCopyResult(result, "代码已复制到剪贴板");
    },
    [handleCopyResult],
  );

  // 复制所有代码块
  const copyAllCode = useCallback(
    async (markdown: string): Promise<boolean> => {
      setCopyState("copying");
      const result = await copyAllCodeBlocks(markdown);
      return handleCopyResult(result, "所有代码块已复制到剪贴板");
    },
    [handleCopyResult],
  );

  // 复制任意文本
  const copyText = useCallback(
    async (text: string): Promise<boolean> => {
      setCopyState("copying");
      const result = await copyToClipboard(text);
      return handleCopyResult(result);
    },
    [handleCopyResult],
  );

  // 隐藏反馈
  const hideFeedback = useCallback(() => {
    setFeedback((prev) => ({ ...prev, show: false }));
  }, []);

  // 重置状态
  const reset = useCallback(() => {
    clearTimers();
    setCopyState("idle");
    setFeedback({ show: false, message: "", type: "success" });
  }, [clearTimers]);

  return {
    copyState,
    feedback,
    copyMessageContent,
    copyCodeContent,
    copyAllCode,
    copyText,
    hideFeedback,
    reset,
  };
}

export default useCopyWithFeedback;
