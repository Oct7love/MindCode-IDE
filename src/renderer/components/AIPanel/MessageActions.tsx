/**
 * MessageActions - 消息操作栏 (增强版)
 * 
 * 功能：
 * - 主 Copy 按钮 (默认 Markdown 格式)
 * - Copy Menu (Plain Text / Markdown / Code Blocks)
 * - 重试、引用、编辑按钮
 * - hover 渐显动画
 */
import React, { useState, useCallback, memo } from 'react';
import { CopyButton } from './CopyButton';
import { CopyMenu } from './CopyMenu';
import './MessageActions.css';
import './CopyButton.css';
import './CopyMenu.css';

// ============================================
// 类型定义
// ============================================

interface MessageActionsProps {
  /** 消息内容 (用于复制) */
  content?: string;
  /** 简单复制回调 (向后兼容) */
  onCopy?: () => void;
  /** 引用回调 */
  onQuote?: () => void;
  /** 重试回调 */
  onRetry?: () => void;
  /** 编辑回调 */
  onEdit?: () => void;
  /** 更多操作回调 */
  onMore?: () => void;
  /** 复制成功回调 */
  onCopySuccess?: (format: string) => void;
  /** 复制失败回调 */
  onCopyError?: (error: string) => void;
  /** 位置 */
  position?: 'top-right' | 'left' | 'bottom' | 'inline';
  /** 紧凑模式 */
  compact?: boolean;
  /** 是否显示 Copy Menu */
  showCopyMenu?: boolean;
}

// ============================================
// 图标组件
// ============================================

const QuoteIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M3.516 7c1.933 0 3.5 1.567 3.5 3.5 0 1.932-1.567 3.5-3.5 3.5S0 12.432 0 10.5C0 6.916 2.916 4 6.5 4v2c-2.5 0-4.5 2-4.5 4.5a1.5 1.5 0 003 0c0-.827-.673-1.5-1.5-1.5h.016zm6.984 0c1.933 0 3.5 1.567 3.5 3.5 0 1.932-1.567 3.5-3.5 3.5S7 12.432 7 10.5C7 6.916 9.916 4 13.5 4v2c-2.5 0-4.5 2-4.5 4.5a1.5 1.5 0 003 0c0-.827-.673-1.5-1.5-1.5h.016z"/>
  </svg>
);

const RetryIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.418A6 6 0 118 2v1z"/>
    <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
  </svg>
);

const EditIcon = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"/>
  </svg>
);

// ============================================
// 主组件
// ============================================

export const MessageActions: React.FC<MessageActionsProps> = memo(({
  content,
  onCopy,
  onQuote,
  onRetry,
  onEdit,
  onMore,
  onCopySuccess,
  onCopyError,
  position = 'top-right',
  compact = false,
  showCopyMenu = true
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  // 处理复制成功
  const handleCopySuccess = useCallback((format?: string) => {
    onCopySuccess?.(format || 'Markdown');
  }, [onCopySuccess]);

  // 处理复制失败
  const handleCopyError = useCallback((error: string) => {
    onCopyError?.(error);
  }, [onCopyError]);

  // 处理菜单关闭
  const handleMenuClose = useCallback(() => {
    setMenuOpen(false);
  }, []);

  // 兼容旧 API：如果提供了 onCopy 但没有 content，使用旧行为
  const hasContent = content && content.trim().length > 0;

  return (
    <div className={`message-actions ${position} ${compact ? 'compact' : ''}`}>
      {/* 主 Copy 按钮 */}
      {(hasContent || onCopy) && (
        hasContent ? (
          <CopyButton
            content={content}
            size={compact ? 'sm' : 'sm'}
            variant="ghost"
            showLabel={!compact}
            onCopySuccess={() => handleCopySuccess('Markdown')}
            onCopyError={handleCopyError}
          />
        ) : (
          <button
            className="action-btn"
            onClick={onCopy}
            title="复制"
            aria-label="复制消息"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
              <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
            </svg>
          </button>
        )
      )}

      {/* Copy Menu (三点菜单) */}
      {showCopyMenu && hasContent && (
        <CopyMenu
          content={content}
          onCopySuccess={handleCopySuccess}
          onCopyError={handleCopyError}
          onClose={handleMenuClose}
        />
      )}

      {/* 引用按钮 */}
      {onQuote && (
        <button
          className="action-btn"
          onClick={onQuote}
          title="引用"
          aria-label="引用消息"
        >
          <QuoteIcon />
        </button>
      )}

      {/* 重试按钮 */}
      {onRetry && (
        <button
          className="action-btn action-retry"
          onClick={onRetry}
          title="重试"
          aria-label="重新生成"
        >
          <RetryIcon />
        </button>
      )}

      {/* 编辑按钮 */}
      {onEdit && (
        <button
          className="action-btn"
          onClick={onEdit}
          title="编辑"
          aria-label="编辑消息"
        >
          <EditIcon />
        </button>
      )}
    </div>
  );
});

MessageActions.displayName = 'MessageActions';
