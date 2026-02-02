/**
 * DiffEditorPanel - Monaco Diff Editor 面板组件
 * 用于显示代码差异对比，支持 Apply/Reject 操作
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as monaco from 'monaco-editor';
import './DiffEditorPanel.css';

interface DiffEditorPanelProps {
  /** 原始文件路径 */
  originalPath: string;
  /** 原始文件内容 */
  originalContent: string;
  /** 修改后的内容 */
  modifiedContent: string;
  /** 语言类型 */
  language?: string;
  /** 应用变更回调 */
  onApply?: (content: string) => void;
  /** 拒绝变更回调 */
  onReject?: () => void;
  /** 关闭面板回调 */
  onClose?: () => void;
  /** 是否显示 */
  isVisible?: boolean;
}

// 获取语言 ID
const getLanguageFromPath = (path: string): string => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const languageMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', html: 'html', css: 'css', scss: 'scss', less: 'less',
    md: 'markdown', py: 'python', go: 'go', rs: 'rust', java: 'java',
    c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp', rb: 'ruby',
    php: 'php', sql: 'sql', sh: 'shell', bash: 'shell', yml: 'yaml', yaml: 'yaml',
    xml: 'xml', vue: 'vue', swift: 'swift', kt: 'kotlin', dart: 'dart',
  };
  return languageMap[ext] || 'plaintext';
};

export const DiffEditorPanel: React.FC<DiffEditorPanelProps> = ({
  originalPath,
  originalContent,
  modifiedContent,
  language,
  onApply,
  onReject,
  onClose,
  isVisible = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const diffEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [viewMode, setViewMode] = useState<'side' | 'inline'>('side');

  // 初始化 Diff Editor
  useEffect(() => {
    if (!containerRef.current || !isVisible) return;

    const lang = language || getLanguageFromPath(originalPath);

    // 创建 Diff Editor
    const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
      automaticLayout: true,
      renderSideBySide: viewMode === 'side',
      readOnly: false,
      originalEditable: false,
      enableSplitViewResizing: true,
      theme: 'mindcode-dark',
      fontSize: 13,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      lineNumbers: 'on',
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      wordWrap: 'off',
      renderOverviewRuler: true,
      diffWordWrap: 'off',
      ignoreTrimWhitespace: false,
    });

    // 创建模型
    const originalModel = monaco.editor.createModel(originalContent, lang);
    const modifiedModel = monaco.editor.createModel(modifiedContent, lang);

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    diffEditorRef.current = diffEditor;

    return () => {
      originalModel.dispose();
      modifiedModel.dispose();
      diffEditor.dispose();
      diffEditorRef.current = null;
    };
  }, [isVisible, originalPath, originalContent, modifiedContent, language, viewMode]);

  // 获取修改后的内容
  const getModifiedContent = useCallback(() => {
    if (!diffEditorRef.current) return modifiedContent;
    const modifiedEditor = diffEditorRef.current.getModifiedEditor();
    return modifiedEditor.getValue();
  }, [modifiedContent]);

  // 应用变更
  const handleApply = useCallback(async () => {
    setIsApplying(true);
    try {
      const content = getModifiedContent();
      await onApply?.(content);
    } finally {
      setIsApplying(false);
    }
  }, [getModifiedContent, onApply]);

  // 切换视图模式
  const toggleViewMode = useCallback(() => {
    setViewMode(prev => prev === 'side' ? 'inline' : 'side');
  }, []);

  if (!isVisible) return null;

  const fileName = originalPath.split(/[/\\]/).pop() || 'file';

  return (
    <div className="diff-editor-panel">
      {/* 头部工具栏 */}
      <div className="diff-editor-header">
        <div className="diff-editor-title">
          <span className="diff-icon">
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v9a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 12.5v-9zM3.5 3a.5.5 0 00-.5.5V7h4V3H3.5zM8 3v4h5V3.5a.5.5 0 00-.5-.5H8zm5 5H8v5h4.5a.5.5 0 00.5-.5V8zm-6 5V8H3v4.5a.5.5 0 00.5.5H7z"/>
            </svg>
          </span>
          <span className="diff-filename">{fileName}</span>
          <span className="diff-path">{originalPath}</span>
        </div>
        <div className="diff-editor-actions">
          {/* 视图切换 */}
          <button
            className="diff-action-btn"
            onClick={toggleViewMode}
            title={viewMode === 'side' ? '切换到内联视图' : '切换到分栏视图'}
          >
            {viewMode === 'side' ? (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M2.5 2A1.5 1.5 0 001 3.5v9A1.5 1.5 0 002.5 14h11a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0013.5 2h-11zM2 3.5a.5.5 0 01.5-.5h11a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-9z"/>
                <path d="M8 3v10"/>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M2.5 2A1.5 1.5 0 001 3.5v9A1.5 1.5 0 002.5 14h11a1.5 1.5 0 001.5-1.5v-9A1.5 1.5 0 0013.5 2h-11zM2 3.5a.5.5 0 01.5-.5h11a.5.5 0 01.5.5v9a.5.5 0 01-.5.5h-11a.5.5 0 01-.5-.5v-9z"/>
              </svg>
            )}
            <span>{viewMode === 'side' ? 'Inline' : 'Side'}</span>
          </button>

          {/* 拒绝按钮 */}
          <button
            className="diff-action-btn diff-reject-btn"
            onClick={onReject}
            title="拒绝变更 (Esc)"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
            <span>Reject</span>
          </button>

          {/* 应用按钮 */}
          <button
            className="diff-action-btn diff-apply-btn"
            onClick={handleApply}
            disabled={isApplying}
            title="应用变更 (Ctrl+Enter)"
          >
            {isApplying ? (
              <span className="loading-spinner-small" />
            ) : (
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
              </svg>
            )}
            <span>{isApplying ? 'Applying...' : 'Apply'}</span>
          </button>

          {/* 关闭按钮 */}
          <button
            className="diff-action-btn diff-close-btn"
            onClick={onClose}
            title="关闭面板"
          >
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Diff Editor 容器 */}
      <div className="diff-editor-container" ref={containerRef} />

      {/* 底部状态栏 */}
      <div className="diff-editor-footer">
        <div className="diff-stats">
          <span className="diff-stat additions">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M8 4a.5.5 0 01.5.5v3h3a.5.5 0 010 1h-3v3a.5.5 0 01-1 0v-3h-3a.5.5 0 010-1h3v-3A.5.5 0 018 4z"/>
            </svg>
            新增
          </span>
          <span className="diff-stat deletions">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
              <path d="M4 8a.5.5 0 01.5-.5h7a.5.5 0 010 1h-7A.5.5 0 014 8z"/>
            </svg>
            删除
          </span>
        </div>
        <div className="diff-shortcuts">
          <kbd>Ctrl+Enter</kbd> 应用 · <kbd>Esc</kbd> 取消
        </div>
      </div>
    </div>
  );
};

export default DiffEditorPanel;
