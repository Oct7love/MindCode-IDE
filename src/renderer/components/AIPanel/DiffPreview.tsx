/**
 * DiffPreview - 代码差异预览组件
 * 
 * 功能：
 * - 使用 Monaco DiffEditor 显示代码对比
 * - 支持接受/拒绝修改
 * - 支持新建文件预览
 */
import React, { useRef, useEffect, useState, useCallback, memo } from 'react';
import * as monaco from 'monaco-editor';
import './DiffPreview.css';

export interface DiffPreviewProps {
  /** 是否显示 */
  isOpen: boolean;
  /** 文件路径 */
  filePath: string;
  /** 原始内容（空字符串表示新文件） */
  originalContent: string;
  /** 修改后内容 */
  modifiedContent: string;
  /** 语言 */
  language: string;
  /** 是否为新文件 */
  isNewFile: boolean;
  /** 接受回调 */
  onAccept: () => void;
  /** 拒绝回调 */
  onReject: () => void;
  /** 关闭回调 */
  onClose: () => void;
}

export const DiffPreview: React.FC<DiffPreviewProps> = memo(({
  isOpen,
  filePath,
  originalContent,
  modifiedContent,
  language,
  isNewFile,
  onAccept,
  onReject,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const [stats, setStats] = useState({ additions: 0, deletions: 0 });

  // 创建 Diff Editor
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // 创建 models
    const originalModel = monaco.editor.createModel(originalContent, language);
    const modifiedModel = monaco.editor.createModel(modifiedContent, language);

    // 创建 Diff Editor
    const diffEditor = monaco.editor.createDiffEditor(containerRef.current, {
      originalEditable: false,
      readOnly: true,
      renderSideBySide: true,
      enableSplitViewResizing: true,
      ignoreTrimWhitespace: false,
      renderIndicators: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      fontSize: 13,
      lineNumbers: 'on',
      theme: 'vs-dark',
      automaticLayout: true,
    });

    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    editorRef.current = diffEditor;

    // 计算统计信息
    const originalLines = originalContent.split('\n');
    const modifiedLines = modifiedContent.split('\n');
    const additions = modifiedLines.filter((line, i) => line !== originalLines[i]).length;
    const deletions = originalLines.filter((line, i) => line !== modifiedLines[i]).length;
    setStats({ additions, deletions: isNewFile ? 0 : deletions });

    return () => {
      diffEditor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
      editorRef.current = null;
    };
  }, [isOpen, originalContent, modifiedContent, language, isNewFile]);

  // ESC 关闭
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 处理接受（onAccept 内部会关闭弹窗，不需要再调用 onClose）
  const handleAccept = useCallback(() => {
    onAccept();
  }, [onAccept]);

  // 处理拒绝（onReject 内部会关闭弹窗，不需要再调用 onClose）
  const handleReject = useCallback(() => {
    onReject();
  }, [onReject]);

  if (!isOpen) return null;

  return (
    <div className="diff-preview-overlay" onClick={onClose}>
      <div className="diff-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="diff-preview-header">
          <div className="diff-preview-title">
            <span className="diff-preview-icon">
              {isNewFile ? '✚' : '✎'}
            </span>
            <span className="diff-preview-path">{filePath}</span>
            {isNewFile && <span className="diff-preview-badge new">NEW</span>}
          </div>
          <div className="diff-preview-stats">
            {stats.additions > 0 && (
              <span className="diff-stat additions">+{stats.additions}</span>
            )}
            {stats.deletions > 0 && (
              <span className="diff-stat deletions">-{stats.deletions}</span>
            )}
          </div>
          <button className="diff-preview-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.28 3.22a.75.75 0 00-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 101.06 1.06L8 9.06l3.72 3.72a.75.75 0 101.06-1.06L9.06 8l3.72-3.72a.75.75 0 00-1.06-1.06L8 6.94 4.28 3.22z"/>
            </svg>
          </button>
        </div>

        {/* Diff Editor */}
        <div className="diff-preview-editor" ref={containerRef} />

        {/* Footer */}
        <div className="diff-preview-footer">
          <div className="diff-preview-info">
            {isNewFile ? (
              <span>将创建新文件</span>
            ) : (
              <span>将修改现有文件</span>
            )}
          </div>
          <div className="diff-preview-actions">
            <button className="diff-btn reject" onClick={handleReject}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.28 3.22a.75.75 0 00-1.06 1.06L6.94 8l-3.72 3.72a.75.75 0 101.06 1.06L8 9.06l3.72 3.72a.75.75 0 101.06-1.06L9.06 8l3.72-3.72a.75.75 0 00-1.06-1.06L8 6.94 4.28 3.22z"/>
              </svg>
              拒绝
            </button>
            <button className="diff-btn accept" onClick={handleAccept}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 111.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
              </svg>
              接受并应用
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

DiffPreview.displayName = 'DiffPreview';

export default DiffPreview;
