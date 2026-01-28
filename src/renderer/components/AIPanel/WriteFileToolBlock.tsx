/**
 * WriteFileToolBlock - 文件写入工具的 Diff 预览组件
 * 当 AI 调用 workspace_writeFile 时，显示 Diff 对比而非普通 ToolBlock
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import { DiffBlock } from './DiffBlock';
import { useFileStore } from '../../stores';

interface WriteFileToolBlockProps {
  id: string;
  filePath: string;
  newContent: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  error?: string;
  duration?: number;
}

export const WriteFileToolBlock: React.FC<WriteFileToolBlockProps> = memo(({
  id,
  filePath,
  newContent,
  status,
  error,
  duration
}) => {
  const [oldContent, setOldContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isApplied, setIsApplied] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isRejected, setIsRejected] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  const { openFiles, updateFileContent, markFileSaved } = useFileStore();

  // 读取原文件内容
  useEffect(() => {
    const loadOriginalContent = async () => {
      setIsLoading(true);
      try {
        const result = await window.mindcode?.fs?.readFile?.(filePath);
        if (result?.success && result.data) {
          setOldContent(result.data);
        } else {
          // 新文件，没有原内容
          setOldContent('');
        }
      } catch (err) {
        console.error('Failed to read original file:', err);
        setOldContent('');
      } finally {
        setIsLoading(false);
      }
    };

    loadOriginalContent();
  }, [filePath]);

  // 如果工具调用成功完成，自动标记为已应用
  useEffect(() => {
    if (status === 'success' && !isApplied && !isRejected) {
      setIsApplied(true);
    }
  }, [status, isApplied, isRejected]);

  // Apply 逻辑
  const handleApply = useCallback(async () => {
    setIsApplying(true);
    setApplyError(null);

    try {
      const result = await window.mindcode?.fs?.writeFile?.(filePath, newContent);
      if (result?.success) {
        setIsApplied(true);

        // 如果文件已在编辑器中打开，同步更新内容
        const openFile = openFiles.find(f => f.path === filePath);
        if (openFile) {
          updateFileContent(openFile.id, newContent);
          markFileSaved(openFile.id);
        }
      } else {
        setApplyError(result?.error || '写入失败');
      }
    } catch (err: any) {
      setApplyError(err.message || '写入失败');
    } finally {
      setIsApplying(false);
    }
  }, [filePath, newContent, openFiles, updateFileContent, markFileSaved]);

  // Reject 逻辑
  const handleReject = useCallback(() => {
    setIsRejected(true);
  }, []);

  // Open in Editor 逻辑
  const handleOpenInEditor = useCallback(async () => {
    const { openFile } = useFileStore.getState();
    const fileName = filePath.split(/[/\\]/).pop() || 'untitled';

    // 以预览模式打开新内容
    openFile({
      id: `preview_${filePath}_${Date.now()}`,
      path: filePath,
      name: `[Preview] ${fileName}`,
      content: newContent,
      language: getLanguageFromPath(filePath),
      isDirty: true
    });
  }, [filePath, newContent]);

  // 从路径推断语言
  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const extMap: Record<string, string> = {
      ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
      py: 'python', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
      java: 'java', go: 'go', rs: 'rust', rb: 'ruby',
      css: 'css', scss: 'scss', less: 'less',
      html: 'html', htm: 'html', xml: 'xml',
      json: 'json', yaml: 'yaml', yml: 'yaml',
      md: 'markdown', txt: 'plaintext'
    };
    return extMap[ext] || 'plaintext';
  };

  // Loading 状态
  if (isLoading) {
    return (
      <div className="tool-block tool-block-running">
        <div className="tool-block-header">
          <div className="tool-block-header-left">
            <span className="tool-block-status tool-block-status-running">⟳</span>
            <span className="tool-block-icon">✏️</span>
            <span className="tool-block-name">workspace writeFile</span>
            <span className="tool-block-args-preview">{filePath}</span>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态（工具调用失败）
  if (status === 'failed' && error) {
    return (
      <div className="tool-block tool-block-failed">
        <div className="tool-block-header">
          <div className="tool-block-header-left">
            <span className="tool-block-status tool-block-status-failed">✗</span>
            <span className="tool-block-icon">✏️</span>
            <span className="tool-block-name">workspace writeFile</span>
            <span className="tool-block-args-preview">{filePath}</span>
          </div>
          {duration && <span className="tool-block-duration">{duration}ms</span>}
        </div>
        <div className="tool-block-content">
          <div className="tool-block-section">
            <div className="tool-block-section-title tool-block-section-error">Error</div>
            <pre className="tool-block-error">{error}</pre>
          </div>
        </div>
      </div>
    );
  }

  // 正常显示 DiffBlock
  return (
    <DiffBlock
      filePath={filePath}
      oldContent={oldContent}
      newContent={newContent}
      language={getLanguageFromPath(filePath)}
      onApply={handleApply}
      onReject={handleReject}
      onOpenInEditor={handleOpenInEditor}
      isApplied={isApplied}
      isApplying={isApplying}
      isRejected={isRejected}
      showActions={status !== 'running'}
    />
  );
});

WriteFileToolBlock.displayName = 'WriteFileToolBlock';
