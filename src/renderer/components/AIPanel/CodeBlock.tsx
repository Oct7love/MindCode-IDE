import React, { useState, useCallback, memo } from 'react';
import './CodeBlock.css';

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
  maxHeight?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** 是否显示 Apply 按钮 */
  showApply?: boolean;
  /** 检测到的文件路径 */
  detectedFilePath?: string | null;
  /** Apply 按钮点击回调 */
  onApply?: (code: string, filePath: string | null, language: string) => void;
}

export const CodeBlock: React.FC<CodeBlockProps> = memo(({
  code,
  language = 'plaintext',
  filename,
  showLineNumbers = true,
  maxHeight = 400,
  collapsible = true,
  defaultCollapsed = false,
  showApply = false,
  detectedFilePath,
  onApply,
}) => {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const [applying, setApplying] = useState(false);

  const lines = code.split('\n');
  const lineCount = lines.length;
  const shouldCollapse = collapsible && lineCount > 20;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [code]);

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  // Apply 处理
  const handleApply = useCallback(() => {
    if (!onApply) return;
    setApplying(true);
    // 调用 Apply 回调
    onApply(code, detectedFilePath || filename || null, language);
    // 短暂显示状态后重置
    setTimeout(() => setApplying(false), 1000);
  }, [code, detectedFilePath, filename, language, onApply]);

  const displayedCode = collapsed ? lines.slice(0, 10).join('\n') : code;
  const displayedLines = collapsed ? lines.slice(0, 10) : lines;

  return (
    <div className="code-block">
      {/* Header */}
      <div className="code-block-header">
        <div className="code-block-header-left">
          {filename ? (
            <span className="code-block-filename">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M3.5 1h6.586a1.5 1.5 0 011.06.44l2.415 2.414a1.5 1.5 0 01.439 1.06V13a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13V2.5A1.5 1.5 0 013.5 1z"/>
              </svg>
              {filename}
            </span>
          ) : (
            <span className="code-block-lang">{language}</span>
          )}
          {lineCount > 1 && (
            <span className="code-block-lines">{lineCount} lines</span>
          )}
        </div>
        <div className="code-block-header-right">
          {shouldCollapse && (
            <button
              className="code-block-btn"
              onClick={toggleCollapse}
              title={collapsed ? 'Expand' : 'Collapse'}
            >
              {collapsed ? (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M4 6l4 4 4-4H4z"/>
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M4 10l4-4 4 4H4z"/>
                </svg>
              )}
            </button>
          )}
          <button
            className={`code-block-btn code-block-copy ${copied ? 'copied' : ''}`}
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy code'}
          >
            {copied ? (
              <>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                </svg>
                <span>Copied</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                  <path d="M5 2a1 1 0 00-1 1v10a1 1 0 001 1h6a1 1 0 001-1V3a1 1 0 00-1-1H5zm0-1h6a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V3a2 2 0 012-2z"/>
                  <path d="M3 4v10a2 2 0 002 2h6"/>
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
          {/* Apply 按钮 */}
          {showApply && onApply && (
            <button
              className={`code-block-btn code-block-apply ${applying ? 'applying' : ''}`}
              onClick={handleApply}
              title={detectedFilePath ? `Apply to ${detectedFilePath}` : 'Apply code'}
              disabled={applying}
            >
              {applying ? (
                <>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" className="spin">
                    <path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.5a5.5 5.5 0 110 11 5.5 5.5 0 010-11z" opacity="0.3"/>
                    <path d="M8 1v1.5a5.5 5.5 0 015.5 5.5H15A7 7 0 008 1z"/>
                  </svg>
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                  </svg>
                  <span>Apply</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Code Content */}
      <div
        className={`code-block-content ${collapsed ? 'collapsed' : ''}`}
        style={{ maxHeight: collapsed ? 'none' : maxHeight }}
      >
        <pre>
          {showLineNumbers && (
            <div className="code-block-gutter">
              {displayedLines.map((_, i) => (
                <span key={i} className="code-block-line-number">{i + 1}</span>
              ))}
            </div>
          )}
          <code className={`language-${language}`}>
            {displayedCode}
          </code>
        </pre>
      </div>

      {/* Collapse Indicator */}
      {shouldCollapse && collapsed && (
        <div className="code-block-collapsed-indicator" onClick={toggleCollapse}>
          <span>... {lineCount - 10} more lines</span>
          <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
            <path d="M4 6l4 4 4-4H4z"/>
          </svg>
        </div>
      )}
    </div>
  );
});

CodeBlock.displayName = 'CodeBlock';
