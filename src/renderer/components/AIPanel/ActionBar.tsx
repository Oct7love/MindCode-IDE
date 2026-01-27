import React, { useState, useCallback, memo } from 'react';
import './ActionBar.css';

export type ActionType = 'file_write' | 'file_edit' | 'file_delete' | 'terminal' | 'git' | 'generic';
export type ActionState = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed';

interface ActionBarProps {
  id: string;
  type: ActionType;
  title: string;
  description?: string;
  filePath?: string;
  state: ActionState;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onPreview?: (id: string) => void;
  children?: React.ReactNode;
}

const ACTION_ICONS: Record<ActionType, string> = {
  file_write: '📝',
  file_edit: '✏️',
  file_delete: '🗑️',
  terminal: '💻',
  git: '📊',
  generic: '⚡'
};

const STATE_CONFIG: Record<ActionState, { label: string; className: string }> = {
  pending: { label: '等待审批', className: 'pending' },
  approved: { label: '已批准', className: 'approved' },
  rejected: { label: '已拒绝', className: 'rejected' },
  executing: { label: '执行中...', className: 'executing' },
  completed: { label: '已完成', className: 'completed' },
  failed: { label: '执行失败', className: 'failed' }
};

export const ActionBar: React.FC<ActionBarProps> = memo(({
  id,
  type,
  title,
  description,
  filePath,
  state,
  onApprove,
  onReject,
  onPreview,
  children
}) => {
  const [expanded, setExpanded] = useState(false);

  const icon = ACTION_ICONS[type];
  const stateConfig = STATE_CONFIG[state];
  const isPending = state === 'pending';
  const isExecuting = state === 'executing';

  const handleApprove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onApprove?.(id);
  }, [id, onApprove]);

  const handleReject = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onReject?.(id);
  }, [id, onReject]);

  const handlePreview = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onPreview?.(id);
  }, [id, onPreview]);

  const toggleExpand = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  return (
    <div className={`action-bar action-bar-${stateConfig.className}`}>
      {/* Header */}
      <div className="action-bar-header" onClick={toggleExpand}>
        <div className="action-bar-header-left">
          <span className="action-bar-icon">{icon}</span>
          <div className="action-bar-info">
            <span className="action-bar-title">{title}</span>
            {filePath && (
              <span className="action-bar-path">{filePath}</span>
            )}
          </div>
        </div>

        <div className="action-bar-header-right">
          {/* State Badge */}
          <span className={`action-bar-state action-bar-state-${stateConfig.className}`}>
            {isExecuting && <span className="action-bar-spinner">⟳</span>}
            {stateConfig.label}
          </span>

          {/* Action Buttons */}
          {isPending && (
            <div className="action-bar-actions">
              {onPreview && (
                <button
                  className="action-bar-btn action-bar-btn-preview"
                  onClick={handlePreview}
                  title="预览变更"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M8 3.5a4.5 4.5 0 00-4.32 3.24.75.75 0 01-1.44-.42A6 6 0 0114 8a6 6 0 01-6 6 6 6 0 01-5.76-4.32.75.75 0 111.44-.42A4.5 4.5 0 008 12.5a4.5 4.5 0 004.5-4.5 4.5 4.5 0 00-4.5-4.5z"/>
                    <path d="M8 6a2 2 0 100 4 2 2 0 000-4z"/>
                  </svg>
                </button>
              )}
              <button
                className="action-bar-btn action-bar-btn-reject"
                onClick={handleReject}
                title="拒绝 (Esc)"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                </svg>
              </button>
              <button
                className="action-bar-btn action-bar-btn-approve"
                onClick={handleApprove}
                title="批准执行 (Enter)"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                </svg>
                <span>批准</span>
              </button>
            </div>
          )}

          {/* Expand Arrow (when has children) */}
          {children && (
            <span className={`action-bar-expand ${expanded ? 'expanded' : ''}`}>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M4 6l4 4 4-4H4z"/>
              </svg>
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {description && (
        <div className="action-bar-description">{description}</div>
      )}

      {/* Expanded Content (e.g., DiffBlock) */}
      {expanded && children && (
        <div className="action-bar-content">
          {children}
        </div>
      )}

      {/* Keyboard Hint */}
      {isPending && (
        <div className="action-bar-hint">
          <kbd>Enter</kbd> 批准 · <kbd>Esc</kbd> 拒绝 · <kbd>D</kbd> 查看差异
        </div>
      )}
    </div>
  );
});

ActionBar.displayName = 'ActionBar';
