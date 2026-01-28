/**
 * AssistantMessage - AI 消息卡片 (增强版)
 * Cursor 风格的高级 IDE 消息组件
 *
 * 特性:
 * - 卡片式设计，带微妙边框和阴影
 * - hover 显示操作栏 (复制/引用/重试)
 * - 右键菜单支持多种复制格式
 * - 快捷键支持 (Ctrl/Cmd+C)
 * - 流式输出时末尾闪烁光标
 * - 工具调用块渲染
 * - Plan 卡片渲染
 */
import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolBlock, ToolStatus } from './ToolBlock';
import { MessageActions } from './MessageActions';
import { MessageContextMenu, ContextMenuPosition } from './MessageContextMenu';
import { CopyFeedback } from './CopyFeedback';
import { AIMode } from '../../stores';
import './AssistantMessage.css';
import './MessageContextMenu.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode?: AIMode;
  toolCalls?: any[];
  plan?: any;
  isStreaming?: boolean;
}

interface AssistantMessageProps {
  message: Message;
  isLast: boolean;
  onCopy?: (content: string) => void;
  onCopyTool?: (content: string) => void;
  onRetry?: (messageId: string) => void;
  /** 全局复制成功回调 (用于显示 Toast) */
  onCopySuccess?: (format: string) => void;
  /** 全局复制失败回调 */
  onCopyError?: (error: string) => void;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = memo(({
  message,
  isLast,
  onCopy,
  onCopyTool,
  onRetry,
  onCopySuccess,
  onCopyError
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    position: ContextMenuPosition;
  }>({ isOpen: false, position: { x: 0, y: 0 } });
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  
  const messageRef = useRef<HTMLDivElement>(null);
  
  const hasError = message.content.startsWith('错误:') || message.content.startsWith('Error:');
  const wasInterrupted = message.content.includes('[已停止]');

  // 右键菜单处理
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // 如果用户选中了文本，不劫持默认行为
    const selection = window.getSelection();
    if (selection && selection.toString().trim().length > 0) {
      return;
    }
    
    e.preventDefault();
    setContextMenu({
      isOpen: true,
      position: { x: e.clientX, y: e.clientY }
    });
  }, []);

  // 关闭右键菜单
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // 复制成功处理
  const handleCopySuccess = useCallback((format: string) => {
    setFeedbackMessage(`已复制 ${format} 到剪贴板`);
    setShowFeedback(true);
    onCopySuccess?.(format);
    onCopy?.(message.content);
  }, [message.content, onCopy, onCopySuccess]);

  // 复制失败处理
  const handleCopyError = useCallback((error: string) => {
    setFeedbackMessage('复制失败');
    setShowFeedback(true);
    onCopyError?.(error);
  }, [onCopyError]);

  // 隐藏反馈
  const handleHideFeedback = useCallback(() => {
    setShowFeedback(false);
  }, []);

  // 快捷键处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 只在当前消息被 hover 或 focus 时响应
      if (!isHovered && !isFocused) return;
      
      // 如果用户选中了文本，不劫持
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }

      // 如果是流式输出中，不响应
      if (message.isStreaming) return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + C
      if (modKey && e.key === 'c') {
        e.preventDefault();
        // 导入并使用 copyService
        import('./utils/copyService').then(({ copyMessage }) => {
          const format = e.shiftKey ? 'plaintext' : 'markdown';
          copyMessage(message.content, format).then(result => {
            if (result.success) {
              handleCopySuccess(e.shiftKey ? 'Plain Text' : 'Markdown');
            } else {
              handleCopyError(result.error || 'Copy failed');
            }
          });
        });
      }
    };

    if (isHovered || isFocused) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isHovered, isFocused, message.content, message.isStreaming, handleCopySuccess, handleCopyError]);

  return (
    <div
      ref={messageRef}
      className={`assistant-message group ${message.isStreaming ? 'streaming' : ''} ${hasError ? 'error' : ''} ${wasInterrupted ? 'interrupted' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      onContextMenu={handleContextMenu}
      tabIndex={0}
      role="article"
      aria-label="AI 消息"
    >
      {/* 头像 */}
      <div className="message-avatar message-avatar-ai">
        <span className="avatar-icon">✦</span>
      </div>

      {/* 消息体 */}
      <div className="message-body">
        {/* 内容卡片 */}
        <div className="message-card">
          <div className="message-content">
            <MarkdownRenderer content={message.content} />
            {message.isStreaming && <span className="streaming-cursor" />}
          </div>
        </div>

        {/* 操作栏 - 文本下方，hover 显示 */}
        {(isHovered || isFocused) && !message.isStreaming && (
          <MessageActions
            content={message.content}
            onCopySuccess={handleCopySuccess}
            onCopyError={handleCopyError}
            onRetry={hasError || wasInterrupted ? () => onRetry?.(message.id) : undefined}
            position="inline"
            showCopyMenu={true}
            compact={true}
          />
        )}

        {/* 工具调用块 */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="message-tools">
            {message.toolCalls.map(tc => (
              <ToolBlock
                key={tc.id}
                id={tc.id}
                name={tc.name}
                args={tc.args}
                status={tc.status as ToolStatus}
                result={tc.result}
                error={tc.error}
                onCopy={onCopyTool}
              />
            ))}
          </div>
        )}

        {/* Plan 卡片 */}
        {message.plan && (
          <div className="message-plan">
            <div className="plan-header">
              <span className="plan-icon">📋</span>
              <span className="plan-title">{message.plan.title}</span>
            </div>
            <div className="plan-tasks">
              {message.plan.tasks.slice(0, 4).map((t: any) => (
                <div key={t.id} className="plan-task">
                  <span className="task-bullet">○</span>
                  <span className="task-label">{t.label}</span>
                </div>
              ))}
              {message.plan.tasks.length > 4 && (
                <div className="plan-more">
                  +{message.plan.tasks.length - 4} 更多任务
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 右键菜单 */}
      <MessageContextMenu
        isOpen={contextMenu.isOpen}
        position={contextMenu.position}
        content={message.content}
        onClose={handleCloseContextMenu}
        onCopySuccess={handleCopySuccess}
        onCopyError={handleCopyError}
      />

      {/* 本地复制反馈 (可选，也可以用全局 Toast) */}
      <CopyFeedback
        show={showFeedback}
        message={feedbackMessage}
        position="top"
        duration={1500}
        onHide={handleHideFeedback}
      />
    </div>
  );
});

AssistantMessage.displayName = 'AssistantMessage';
