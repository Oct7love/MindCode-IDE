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
  onCopy
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

  return (
    <div className="diff-block">
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
    </div>
  );
});

DiffBlock.displayName = 'DiffBlock';
