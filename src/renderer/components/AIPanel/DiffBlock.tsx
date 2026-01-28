import React, { useState, useCallback, memo, useMemo } from 'react';
import './DiffBlock.css';

export type DiffLineType = 'unchanged' | 'added' | 'removed' | 'context';

interface DiffLine {
  type: DiffLineType;
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

interface DiffBlockProps {
  filePath: string;
  oldContent?: string;
  newContent?: string;
  diffLines?: DiffLine[];
  language?: string;
  maxHeight?: number;
  onCopy?: (content: string) => void;
  // Phase 1 新增
  onApply?: () => void | Promise<void>;
  onReject?: () => void;
  onOpenInEditor?: () => void;
  showActions?: boolean;
  isApplied?: boolean;
  isApplying?: boolean;
  isRejected?: boolean;
}

// 简单的 diff 算法生成变更行
function computeDiffLines(oldContent: string, newContent: string): DiffLine[] {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const result: DiffLine[] = [];

  // 简化版：使用 LCS 思路的基础比较
  let oldIdx = 0;
  let newIdx = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    if (oldIdx >= oldLines.length) {
      // 剩余的都是新增
      result.push({
        type: 'added',
        content: newLines[newIdx],
        newLineNumber: newLineNum++
      });
      newIdx++;
    } else if (newIdx >= newLines.length) {
      // 剩余的都是删除
      result.push({
        type: 'removed',
        content: oldLines[oldIdx],
        oldLineNumber: oldLineNum++
      });
      oldIdx++;
    } else if (oldLines[oldIdx] === newLines[newIdx]) {
      // 相同行
      result.push({
        type: 'unchanged',
        content: oldLines[oldIdx],
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++
      });
      oldIdx++;
      newIdx++;
    } else {
      // 查找是否在后面能匹配到
      const oldInNew = newLines.indexOf(oldLines[oldIdx], newIdx);
      const newInOld = oldLines.indexOf(newLines[newIdx], oldIdx);

      if (oldInNew !== -1 && (newInOld === -1 || oldInNew - newIdx <= newInOld - oldIdx)) {
        // 新增行
        result.push({
          type: 'added',
          content: newLines[newIdx],
          newLineNumber: newLineNum++
        });
        newIdx++;
      } else if (newInOld !== -1) {
        // 删除行
        result.push({
          type: 'removed',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum++
        });
        oldIdx++;
      } else {
        // 替换：先删除再新增
        result.push({
          type: 'removed',
          content: oldLines[oldIdx],
          oldLineNumber: oldLineNum++
        });
        result.push({
          type: 'added',
          content: newLines[newIdx],
          newLineNumber: newLineNum++
        });
        oldIdx++;
        newIdx++;
      }
    }
  }

  return result;
}

export const DiffBlock: React.FC<DiffBlockProps> = memo(({
  filePath,
  oldContent = '',
  newContent = '',
  diffLines: providedDiffLines,
  language = 'plaintext',
  maxHeight = 400,
  onCopy,
  onApply,
  onReject,
  onOpenInEditor,
  showActions = true,
  isApplied = false,
  isApplying = false,
  isRejected = false
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  // 计算或使用提供的 diff 行
  const diffLines = useMemo(() => {
    if (providedDiffLines) return providedDiffLines;
    return computeDiffLines(oldContent, newContent);
  }, [providedDiffLines, oldContent, newContent]);

  // 统计变更
  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  const handleCopyNew = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(newContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(newContent);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [newContent, onCopy]);

  const getFileName = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1];
  };

  // 状态类名
  const statusClass = isApplied ? 'diff-block-applied' : isRejected ? 'diff-block-rejected' : '';

  return (
    <div className={`diff-block ${statusClass}`}>
      {/* Header */}
      <div className="diff-block-header">
        <div className="diff-block-header-left">
          <span className="diff-block-file-icon">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.5 1h6.586a1.5 1.5 0 011.06.44l2.415 2.414a1.5 1.5 0 01.439 1.06V13a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13V2.5A1.5 1.5 0 013.5 1z"/>
            </svg>
          </span>
          <span className="diff-block-filename">{getFileName(filePath)}</span>
          <span className="diff-block-path">{filePath}</span>
        </div>
        <div className="diff-block-header-right">
          {/* Stats */}
          <div className="diff-block-stats">
            {stats.added > 0 && (
              <span className="diff-block-stat diff-block-stat-added">+{stats.added}</span>
            )}
            {stats.removed > 0 && (
              <span className="diff-block-stat diff-block-stat-removed">-{stats.removed}</span>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="diff-block-view-toggle">
            <button
              className={`diff-block-view-btn ${viewMode === 'unified' ? 'active' : ''}`}
              onClick={() => setViewMode('unified')}
              title="统一视图"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M2 3h12v2H2V3zm0 4h12v2H2V7zm0 4h12v2H2v-2z"/>
              </svg>
            </button>
            <button
              className={`diff-block-view-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
              title="分栏视图"
            >
              <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
                <path d="M2 3h5v10H2V3zm7 0h5v10H9V3z"/>
              </svg>
            </button>
          </div>

          {/* Copy Button */}
          <button
            className={`diff-block-btn ${copied ? 'copied' : ''}`}
            onClick={handleCopyNew}
            title={copied ? '已复制!' : '复制新内容'}
          >
            {copied ? '✓' : '📋'}
          </button>
        </div>
      </div>

      {/* Diff Content */}
      <div className="diff-block-content" style={{ maxHeight }}>
        {viewMode === 'unified' ? (
          <div className="diff-block-unified">
            {diffLines.map((line, idx) => (
              <div key={idx} className={`diff-line diff-line-${line.type}`}>
                <span className="diff-line-gutter">
                  <span className="diff-line-number diff-line-number-old">
                    {line.oldLineNumber || ''}
                  </span>
                  <span className="diff-line-number diff-line-number-new">
                    {line.newLineNumber || ''}
                  </span>
                  <span className="diff-line-sign">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                </span>
                <span className="diff-line-content">
                  <code>{line.content}</code>
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="diff-block-split">
            {/* Old Side */}
            <div className="diff-block-side diff-block-side-old">
              <div className="diff-block-side-header">原始</div>
              {diffLines.filter(l => l.type !== 'added').map((line, idx) => (
                <div key={idx} className={`diff-line diff-line-${line.type}`}>
                  <span className="diff-line-number">{line.oldLineNumber || ''}</span>
                  <span className="diff-line-content">
                    <code>{line.content}</code>
                  </span>
                </div>
              ))}
            </div>
            {/* New Side */}
            <div className="diff-block-side diff-block-side-new">
              <div className="diff-block-side-header">修改后</div>
              {diffLines.filter(l => l.type !== 'removed').map((line, idx) => (
                <div key={idx} className={`diff-line diff-line-${line.type}`}>
                  <span className="diff-line-number">{line.newLineNumber || ''}</span>
                  <span className="diff-line-content">
                    <code>{line.content}</code>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions Bar */}
      {showActions && (onApply || onReject || onOpenInEditor) && (
        <div className="diff-block-actions">
          {isApplied ? (
            <span className="diff-block-status diff-block-status-applied">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
              </svg>
              已应用
            </span>
          ) : isRejected ? (
            <span className="diff-block-status diff-block-status-rejected">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
              </svg>
              已拒绝
            </span>
          ) : (
            <>
              {onApply && (
                <button
                  className="diff-block-action-btn diff-block-action-apply"
                  onClick={onApply}
                  disabled={isApplying}
                  title="应用变更"
                >
                  {isApplying ? (
                    <>
                      <span className="diff-block-spinner" />
                      应用中...
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                      </svg>
                      Apply
                    </>
                  )}
                </button>
              )}
              {onReject && (
                <button
                  className="diff-block-action-btn diff-block-action-reject"
                  onClick={onReject}
                  disabled={isApplying}
                  title="拒绝变更"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
                  </svg>
                  Reject
                </button>
              )}
              {onOpenInEditor && (
                <button
                  className="diff-block-action-btn diff-block-action-editor"
                  onClick={onOpenInEditor}
                  disabled={isApplying}
                  title="在编辑器中打开"
                >
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M4.708 5.578L2.061 8.224l2.647 2.646-.708.708-3-3V7.87l3-3 .708.708zm7-.708L11 5.578l2.647 2.646L11 10.87l.708.708 3-3v-.708l-3-3zM4.908 13l.894.448 5-10L9.908 3l-5 10z"/>
                  </svg>
                  Open in Editor
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
});

DiffBlock.displayName = 'DiffBlock';
