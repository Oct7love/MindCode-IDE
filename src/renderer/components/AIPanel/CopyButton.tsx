/**
 * CopyButton - 专业级复制按钮组件
 *
 * 特性：
 * - 状态机管理 (idle -> copying -> success/error -> idle)
 * - 成功/失败反馈动画
 * - 支持不同尺寸和变体
 * - 键盘可访问
 */
import React, { useState, useCallback, useRef, useEffect, memo } from "react";
import type { CopyResult } from "./utils/copyService";
import { copyToClipboard } from "./utils/copyService";
import "./CopyButton.css";

// ============================================
// 类型定义
// ============================================

type CopyState = "idle" | "copying" | "success" | "error";

interface CopyButtonProps {
  /** 要复制的内容 */
  content: string;
  /** 按钮尺寸 */
  size?: "xs" | "sm" | "md";
  /** 变体样式 */
  variant?: "default" | "ghost" | "solid";
  /** 是否显示文案 */
  showLabel?: boolean;
  /** 成功提示文案 */
  successLabel?: string;
  /** 默认文案 */
  defaultLabel?: string;
  /** 复制成功回调 */
  onCopySuccess?: () => void;
  /** 复制失败回调 */
  onCopyError?: (error: string) => void;
  /** 自定义类名 */
  className?: string;
  /** tooltip */
  title?: string;
  /** 成功状态持续时间 (ms) */
  successDuration?: number;
}

// ============================================
// 图标组件
// ============================================

const CopyIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
    <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
  </svg>
);

const ErrorIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
  </svg>
);

// ============================================
// 主组件
// ============================================

export const CopyButton: React.FC<CopyButtonProps> = memo(
  ({
    content,
    size = "sm",
    variant = "ghost",
    showLabel = true,
    successLabel = "Copied",
    defaultLabel = "Copy",
    onCopySuccess,
    onCopyError,
    className = "",
    title,
    successDuration = 1200,
  }) => {
    const [state, setState] = useState<CopyState>("idle");
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    // 清理定时器
    useEffect(() => {
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const handleCopy = useCallback(
      async (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (state === "copying" || state === "success") return;

        setState("copying");

        const result: CopyResult = await copyToClipboard(content);

        if (result.success) {
          setState("success");
          onCopySuccess?.();

          timeoutRef.current = setTimeout(() => {
            setState("idle");
          }, successDuration);
        } else {
          setState("error");
          onCopyError?.(result.error || "Copy failed");

          timeoutRef.current = setTimeout(() => {
            setState("idle");
          }, 1500);
        }
      },
      [content, state, onCopySuccess, onCopyError, successDuration],
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleCopy(e as unknown as React.MouseEvent);
        }
      },
      [handleCopy],
    );

    // 根据状态获取图标
    const Icon = state === "success" ? CheckIcon : state === "error" ? ErrorIcon : CopyIcon;

    // 根据状态获取文案
    const label = state === "success" ? successLabel : state === "error" ? "Failed" : defaultLabel;

    // 动态 title
    const buttonTitle =
      state === "success"
        ? "Copied to clipboard!"
        : state === "error"
          ? "Copy failed"
          : title || "Copy to clipboard";

    return (
      <button
        type="button"
        className={`copy-btn copy-btn-${size} copy-btn-${variant} copy-btn-${state} ${className}`}
        onClick={handleCopy}
        onKeyDown={handleKeyDown}
        title={buttonTitle}
        aria-label={buttonTitle}
        disabled={state === "copying"}
      >
        <span className="copy-btn-icon">
          <Icon />
        </span>
        {showLabel && <span className="copy-btn-label">{label}</span>}
      </button>
    );
  },
);

CopyButton.displayName = "CopyButton";

export default CopyButton;
