/**
 * MindCode - 内联编辑组件
 * 实现 Cursor 风格的 Ctrl+K 内联编辑功能
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';

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
          <span className="inline-edit-icon">✦</span>
          <span className="inline-edit-title">AI 编辑</span>
          <button className="inline-edit-close" onClick={onClose}>×</button>
        </div>

        {/* 输入区域 */}
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
        </div>

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
          </div>
        )}

        {/* 生成的代码预览 */}
        {displayCode && (
          <div className="inline-edit-preview">
            <div className="inline-edit-preview-header">
              <span>修改预览</span>
              {showDiff && (
                <span className="inline-edit-diff-label">
                  {generatedCode.length > selectedCode.length ? '+' : ''}
                  {generatedCode.length - selectedCode.length} 字符
                </span>
              )}
            </div>
            <pre className="inline-edit-code">
              <code>{displayCode}</code>
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
              取消
            </button>
            <button
              className="inline-edit-btn inline-edit-btn-primary"
              onClick={handleApply}
            >
              应用修改 (Enter)
            </button>
          </div>
        )}

        {/* 快捷键提示 */}
        <div className="inline-edit-hints">
          <span><kbd>Enter</kbd> {showDiff ? '应用' : '生成'}</span>
          <span><kbd>Esc</kbd> 取消</span>
          <span><kbd>Shift+Enter</kbd> 换行</span>
        </div>
      </div>
    </div>
  );
};

export default InlineEditWidget;
