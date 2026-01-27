/**
 * MessageActions - 消息操作栏
 * hover 时显示的操作按钮组
 */
import React, { memo } from 'react';
import './MessageActions.css';

interface MessageActionsProps {
  onCopy?: () => void;
  onQuote?: () => void;
  onRetry?: () => void;
  onEdit?: () => void;
  onMore?: () => void;
  position?: 'top-right' | 'left' | 'bottom';
  compact?: boolean;
}

export const MessageActions: React.FC<MessageActionsProps> = memo(({
  onCopy,
  onQuote,
  onRetry,
  onEdit,
  onMore,
  position = 'top-right',
  compact = false
}) => {
  return (
    <div className={`message-actions ${position} ${compact ? 'compact' : ''}`}>
      {onCopy && (
        <button
          className="action-btn"
          onClick={onCopy}
          title="复制"
          aria-label="复制消息"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M4 4h8v8H4zM2 2v10h2V4h8V2z"/>
          </svg>
        </button>
      )}

      {onQuote && (
        <button
          className="action-btn"
          onClick={onQuote}
          title="引用"
          aria-label="引用消息"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M6 10c0-3 2-5 5-5V3c-5 0-7 3-7 7v3h4v-3H6zm7 0c0-3 2-5 5-5V3c-5 0-7 3-7 7v3h4v-3h-2z"/>
          </svg>
        </button>
      )}

      {onRetry && (
        <button
          className="action-btn action-retry"
          onClick={onRetry}
          title="重试"
          aria-label="重新生成"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M13.5 8a5.5 5.5 0 11-11 0 5.5 5.5 0 0111 0zm-1.4-3.2L14 3v4h-4l1.7-1.7A4 4 0 108 12a4 4 0 003.5-2h1.6a5.5 5.5 0 01-10.6 0A5.5 5.5 0 0112.1 4.8z"/>
          </svg>
        </button>
      )}

      {onEdit && (
        <button
          className="action-btn"
          onClick={onEdit}
          title="编辑"
          aria-label="编辑消息"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M12.1 1.3l2.6 2.6-9.5 9.5H2.5v-2.6l9.6-9.5zm.7.7L3.5 11.3v1.2h1.2L14 3.2 12.8 2z"/>
          </svg>
        </button>
      )}

      {onMore && (
        <button
          className="action-btn"
          onClick={onMore}
          title="更多"
          aria-label="更多操作"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M3 8a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0zm5 0a1.5 1.5 0 113 0 1.5 1.5 0 01-3 0z"/>
          </svg>
        </button>
      )}
    </div>
  );
});

MessageActions.displayName = 'MessageActions';
