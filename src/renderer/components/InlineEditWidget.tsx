/**
 * MindCode - 内联编辑组件 (增强版)
 * 实现 Cursor 风格的 Ctrl+K 内联编辑功能
 * 
 * 特性:
 * - 选中代码后触发 Ctrl+K
 * - AI 生成修改建议
 * - Inline Diff 预览（红色/绿色高亮）
 * - Tab 接受 / Escape 拒绝
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';

interface InlineEditWidgetProps {
  isOpen: boolean;
  position: { top: number; left: number };
  selectedCode: string;
  language: string;
  onClose: () => void;
  onApply: (newCode: string) => void;
  onAIChat: (prompt: string, code: string, callbacks: {
    onToken: (token: string) => void;
    onComplete: (result: string) => void;
    onError: (error: string) => void;
  }) => void;
}

// 简单的 Diff 计算
interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  lineNumber?: number;
}

function computeSimpleDiff(original: string, modified: string): DiffLine[] {
  const originalLines = original.split('\n');
  const modifiedLines = modified.split('\n');
  const result: DiffLine[] = [];
  
  const maxLen = Math.max(originalLines.length, modifiedLines.length);
  let originalIdx = 0;
  let modifiedIdx = 0;
  
  while (originalIdx < originalLines.length || modifiedIdx < modifiedLines.length) {
    const origLine = originalLines[originalIdx];
    const modLine = modifiedLines[modifiedIdx];
    
    if (originalIdx >= originalLines.length) {
      // 只有新增的行
      result.push({ type: 'added', content: modLine, lineNumber: modifiedIdx + 1 });
      modifiedIdx++;
    } else if (modifiedIdx >= modifiedLines.length) {
      // 只有删除的行
      result.push({ type: 'removed', content: origLine });
      originalIdx++;
    } else if (origLine === modLine) {
      // 相同的行
      result.push({ type: 'unchanged', content: origLine, lineNumber: modifiedIdx + 1 });
      originalIdx++;
      modifiedIdx++;
    } else {
      // 不同的行 - 标记为删除+新增
      result.push({ type: 'removed', content: origLine });
      result.push({ type: 'added', content: modLine, lineNumber: modifiedIdx + 1 });
      originalIdx++;
      modifiedIdx++;
    }
  }
  
  return result;
}

export const InlineEditWidget: React.FC<InlineEditWidgetProps> = ({
  isOpen,
  position,
  selectedCode,
  language,
  onClose,
  onApply,
  onAIChat
}) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');
  const [streamingCode, setStreamingCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showDiff, setShowDiff] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 计算 Diff
  const diffLines = useMemo(() => {
    if (!showDiff || !generatedCode) return [];
    return computeSimpleDiff(selectedCode, generatedCode);
  }, [showDiff, selectedCode, generatedCode]);

  // 统计
  const stats = useMemo(() => {
    const added = diffLines.filter(l => l.type === 'added').length;
    const removed = diffLines.filter(l => l.type === 'removed').length;
    return { added, removed };
  }, [diffLines]);

  // 聚焦输入框
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setPrompt('');
      setGeneratedCode('');
      setStreamingCode('');
      setError(null);
      setShowDiff(false);
    }
  }, [isOpen]);

  // 全局键盘事件（Tab 接受）
  useEffect(() => {
    if (!showDiff || !generatedCode) return;
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        handleApply();
      }
    };
    
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, [showDiff, generatedCode]);

  // 提交编辑请求
  const handleSubmit = useCallback(() => {
    if (!prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setStreamingCode('');
    setGeneratedCode('');

    // 构建 AI 提示
    const systemPrompt = `你是一个专业的代码编辑助手。用户选中了以下 ${language} 代码，并希望你根据指令进行修改。

当前选中的代码：
\`\`\`${language}
${selectedCode}
\`\`\`

用户的编辑指令：${prompt}

请直接输出修改后的代码，不需要任何解释或 markdown 格式。只输出纯代码。`;

    onAIChat(systemPrompt, selectedCode, {
      onToken: (token) => {
        setStreamingCode(prev => prev + token);
      },
      onComplete: (result) => {
        // 清理结果：移除可能的 markdown 代码块标记
        let cleanedResult = result.trim();
        const codeBlockRegex = /^```[\w]*\n?([\s\S]*?)```$/;
        const match = cleanedResult.match(codeBlockRegex);
        if (match) {
          cleanedResult = match[1].trim();
        }
        setGeneratedCode(cleanedResult);
        setStreamingCode('');
        setIsLoading(false);
        setShowDiff(true);
      },
      onError: (err) => {
        setError(err);
        setIsLoading(false);
      }
    });
  }, [prompt, isLoading, selectedCode, language, onAIChat]);

  // 应用修改
  const handleApply = useCallback(() => {
    if (generatedCode) {
      onApply(generatedCode);
      onClose();
    }
  }, [generatedCode, onApply, onClose]);

  // 键盘事件
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (showDiff) {
        handleApply();
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [handleSubmit, handleApply, showDiff, onClose]);

  if (!isOpen) return null;

  const displayCode = streamingCode || generatedCode;

  return (
    <div
      ref={containerRef}
      className="inline-edit-widget"
      style={{
        position: 'absolute',
        top: position.top,
        left: position.left,
        zIndex: 1000
      }}
    >
      <div className="inline-edit-container">
        {/* 头部 */}
        <div className="inline-edit-header">
          <div className="inline-edit-header-left">
            <span className="inline-edit-icon">✦</span>
            <span className="inline-edit-title">AI 编辑</span>
            {showDiff && (
              <span className="inline-edit-stats">
                {stats.added > 0 && <span className="stat-added">+{stats.added}</span>}
                {stats.removed > 0 && <span className="stat-removed">-{stats.removed}</span>}
              </span>
            )}
          </div>
          <button className="inline-edit-close" onClick={onClose}>×</button>
        </div>

        {/* 输入区域 */}
        {!showDiff && (
          <div className="inline-edit-input-area">
            <textarea
              ref={inputRef}
              className="inline-edit-input"
              placeholder="描述你想要的修改..."
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              disabled={isLoading}
            />
            {!isLoading && (
              <button 
                className="inline-edit-submit"
                onClick={handleSubmit}
                disabled={!prompt.trim()}
              >
                生成
              </button>
            )}
          </div>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="inline-edit-loading">
            <div className="inline-edit-spinner" />
            <span>AI 正在生成...</span>
          </div>
        )}

        {/* 错误信息 */}
        {error && (
          <div className="inline-edit-error">
            <span>错误: {error}</span>
            <button onClick={() => setError(null)}>重试</button>
          </div>
        )}

        {/* Diff 预览 */}
        {showDiff && diffLines.length > 0 && (
          <div className="inline-edit-diff">
            <div className="inline-edit-diff-header">
              <span>修改预览</span>
            </div>
            <div className="inline-edit-diff-content">
              {diffLines.map((line, i) => (
                <div 
                  key={i} 
                  className={`diff-line diff-line--${line.type}`}
                >
                  <span className="diff-line-indicator">
                    {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                  </span>
                  <span className="diff-line-content">{line.content || ' '}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 流式预览（未完成时） */}
        {streamingCode && !showDiff && (
          <div className="inline-edit-preview">
            <div className="inline-edit-preview-header">
              <span>生成中...</span>
            </div>
            <pre className="inline-edit-code">
              <code>{streamingCode}</code>
              <span className="streaming-cursor" />
            </pre>
          </div>
        )}

        {/* 操作按钮 */}
        {showDiff && generatedCode && (
          <div className="inline-edit-actions">
            <button
              className="inline-edit-btn inline-edit-btn-secondary"
              onClick={onClose}
            >
              <kbd>Esc</kbd> 拒绝
            </button>
            <button
              className="inline-edit-btn inline-edit-btn-primary"
              onClick={handleApply}
            >
              <kbd>Tab</kbd> 接受
            </button>
          </div>
        )}

        {/* 快捷键提示 */}
        {!showDiff && (
          <div className="inline-edit-hints">
            <span><kbd>Enter</kbd> 生成</span>
            <span><kbd>Esc</kbd> 取消</span>
            <span><kbd>Shift+Enter</kbd> 换行</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default InlineEditWidget;
