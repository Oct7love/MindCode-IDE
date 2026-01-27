import React, { useState, useCallback, memo } from 'react';
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
  onCopy
}) => {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const icon = TOOL_ICONS[name] || TOOL_ICONS.default;
  const statusIcon = STATUS_ICONS[status];

  const handleCopy = useCallback(async () => {
    const content = result
      ? JSON.stringify(result, null, 2)
      : JSON.stringify(args, null, 2);

    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      onCopy?.(content);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [result, args, onCopy]);

  const toggleExpand = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);

  const formatToolName = (name: string) => {
    return name.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  };

  const formatArgs = (args: Record<string, any>) => {
    const entries = Object.entries(args);
    if (entries.length === 0) return '(no arguments)';
    if (entries.length === 1) {
      const [key, value] = entries[0];
      const strValue = typeof value === 'string' ? value : JSON.stringify(value);
      return strValue.length > 50 ? strValue.slice(0, 50) + '...' : strValue;
    }
    return `${entries.length} parameters`;
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
              {JSON.stringify(args, null, 2)}
            </pre>
          </div>

          {/* Result or Error */}
          {status === 'success' && result && (
            <div className="tool-block-section">
              <div className="tool-block-section-title tool-block-section-success">Result</div>
              <pre className="tool-block-json">
                {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
              </pre>
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
