import React, { useState, useCallback, memo, useMemo } from 'react';
import { highlightCode, getLanguageFromPath } from '../MarkdownRenderer';
import { WriteFileToolBlock } from './WriteFileToolBlock';
import './ToolBlock.css';

export type ToolStatus = 'pending' | 'running' | 'success' | 'failed';

interface ToolBlockProps {
  id: string;
  name: string;
  args: Record<string, any>;
  status: ToolStatus;
  result?: any;
  error?: string;
  duration?: number;
  onCopy?: (content: string) => void;
  compact?: boolean; // 紧凑模式（默认开启）
}

const TOOL_ICONS: Record<string, string> = {
  workspace_listDir: '📁',
  workspace_readFile: '📄',
  workspace_writeFile: '✏️',
  workspace_search: '🔍',
  editor_getActiveFile: '📝',
  terminal_execute: '💻',
  git_status: '📊',
  git_diff: '📋',
  default: '⚡'
};

const TOOL_LABELS: Record<string, string> = {
  workspace_listDir: 'Workspace List Dir',
  workspace_readFile: 'Read File',
  workspace_writeFile: 'Write File',
  workspace_search: 'Search',
  editor_getActiveFile: 'Get Active File',
  terminal_execute: 'Terminal',
  git_status: 'Git Status',
  git_diff: 'Git Diff',
};

const STATUS_ICONS: Record<ToolStatus, string> = {
  pending: '○',
  running: '⟳',
  success: '✓',
  failed: '✗'
};

export const ToolBlock: React.FC<ToolBlockProps> = memo(({
  id,
  name,
  args,
  status,
  result,
  error,
  duration,
  onCopy,
  compact = true // 默认紧凑模式
}) => {
  // ===== 所有 hooks 必须在最前面，任何条件返回之前 =====
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const copyContent = result ? JSON.stringify(result, null, 2) : JSON.stringify(args, null, 2);
    try {
      await navigator.clipboard.writeText(copyContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(copyContent);
    } catch (err) { console.error('Failed to copy:', err); }
  }, [result, args, onCopy]);

  const toggleExpand = useCallback(() => { setExpanded(prev => !prev); }, []);

  const contentPreview = args.content && typeof args.content === 'string' ? args.content : null;
  const highlightedContent = useMemo(() => {
    if (!contentPreview) return null;
    const language = args.path ? getLanguageFromPath(args.path) : 'text';
    return highlightCode(contentPreview, language);
  }, [contentPreview, args.path]);
  // ===== hooks 结束 =====

  const icon = TOOL_ICONS[name] || TOOL_ICONS.default;
  const statusIcon = STATUS_ICONS[status];
  const label = TOOL_LABELS[name] || name.replace(/_/g, ' ');
  const pathArg = args.path || args.cwd || args.query || '';
  const shortPath = pathArg.length > 30 ? '...' + pathArg.slice(-30) : pathArg;

  // workspace_writeFile 特殊处理
  if (name === 'workspace_writeFile' && args.path && args.content) {
    return <WriteFileToolBlock id={id} filePath={args.path} newContent={args.content} status={status} error={error} duration={duration} />;
  }

  // 紧凑模式：Cursor 风格单行显示
  if (compact && !expanded) {
    return (
      <div className={`tool-block-compact tool-block-compact-${status}`} onClick={() => setExpanded(true)} title="点击展开详情">
        <span className={`tool-compact-status tool-compact-status-${status}`}>
          {status === 'success' ? '✓' : status === 'failed' ? '✗' : status === 'running' ? '⟳' : '○'}
        </span>
        <span className="tool-compact-icon">{icon}</span>
        <span className="tool-compact-label">{label}</span>
        {shortPath && <span className="tool-compact-path">{shortPath}</span>}
        {result?.items && <span className="tool-compact-badge">📋</span>}
        <span className="tool-compact-expand">▾</span>
      </div>
    );
  }

  // 辅助函数
  const formatToolName = (n: string) => n.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  const formatArgs = (a: Record<string, any>) => {
    const entries = Object.entries(a);
    if (entries.length === 0) return '(no arguments)';
    if (entries.length === 1) {
      const [key, value] = entries[0];
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      if (key === 'path' || key === 'cwd' || key === 'query') return strValue.length > 60 ? strValue.slice(0, 60) + '...' : strValue;
      return strValue.length > 50 ? strValue.slice(0, 50) + '...' : strValue;
    }
    if (a.path) return `${a.path}`;
    return `${entries.length} parameters`;
  };
  const formatArgsForDisplay = (a: Record<string, any>) => {
    if (a.content && typeof a.content === 'string') {
      const { content: _, ...rest } = a;
      const otherArgs = Object.keys(rest).length > 0 ? JSON.stringify(rest, null, 2).slice(1, -1) + ',\n' : '';
      return `{\n${otherArgs}  "content": <见下方代码>\n}`;
    }
    return JSON.stringify(a, null, 2);
  };

  return (
    <div className={`tool-block tool-block-${status}`}>
      {/* Header */}
      <div className="tool-block-header" onClick={toggleExpand}>
        <div className="tool-block-header-left">
          <span className={`tool-block-status tool-block-status-${status}`}>
            {statusIcon}
          </span>
          <span className="tool-block-icon">{icon}</span>
          <span className="tool-block-name">{formatToolName(name)}</span>
          <span className="tool-block-args-preview">{formatArgs(args)}</span>
        </div>
        <div className="tool-block-header-right">
          {duration && status !== 'pending' && status !== 'running' && (
            <span className="tool-block-duration">{duration}ms</span>
          )}
          <button
            className={`tool-block-btn ${copied ? 'copied' : ''}`}
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            title={copied ? 'Copied!' : 'Copy'}
          >
            {copied ? '✓' : '📋'}
          </button>
          <span className={`tool-block-expand ${expanded ? 'expanded' : ''}`}>
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M4 6l4 4 4-4H4z"/>
            </svg>
          </span>
        </div>
      </div>

      {/* Expanded Content */}
      {expanded && (
        <div className="tool-block-content">
          {/* Arguments */}
          <div className="tool-block-section">
            <div className="tool-block-section-title">Arguments</div>
            <pre className="tool-block-json">
              {formatArgsForDisplay(args)}
            </pre>
          </div>

          {/* Content Preview (for writeFile etc.) - 带语法高亮 */}
          {contentPreview && highlightedContent && (
            <div className="tool-block-section">
              <div className="tool-block-section-title tool-block-section-code">
                📄 Content {args.path && <span className="tool-block-lang-badge">{getLanguageFromPath(args.path)}</span>}
              </div>
              <div className="tool-block-code-preview">
                <code>{highlightedContent}</code>
              </div>
            </div>
          )}

          {/* Result or Error */}
          {status === 'success' && result && (
            <div className="tool-block-section">
              <div className="tool-block-section-title tool-block-section-success">Result</div>
              {/* 对于 readFile 结果，特殊处理 content 字段 */}
              {name === 'workspace_readFile' && result.content ? (
                <div className="tool-block-code-preview">
                  <code>{highlightCode(result.content, args.path ? getLanguageFromPath(args.path) : 'text')}</code>
                </div>
              ) : (
                <pre className="tool-block-json">
                  {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                </pre>
              )}
            </div>
          )}

          {status === 'failed' && error && (
            <div className="tool-block-section">
              <div className="tool-block-section-title tool-block-section-error">Error</div>
              <pre className="tool-block-error">{error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

ToolBlock.displayName = 'ToolBlock';
