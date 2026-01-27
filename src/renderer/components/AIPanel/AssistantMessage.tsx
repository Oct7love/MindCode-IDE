/**
 * AssistantMessage - AI 消息卡片
 * Cursor 风格的高级 IDE 消息组件
 *
 * 特性:
 * - 卡片式设计，带微妙边框和阴影
 * - hover 显示操作栏 (复制/引用/重试)
 * - 流式输出时末尾闪烁光标
 * - 工具调用块渲染
 * - Plan 卡片渲染
 */
import React, { memo, useState } from 'react';
import { MarkdownRenderer } from '../MarkdownRenderer';
import { ToolBlock, ToolStatus } from './ToolBlock';
import { MessageActions } from './MessageActions';
import { AIMode } from '../../stores';
import './AssistantMessage.css';

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
}

export const AssistantMessage: React.FC<AssistantMessageProps> = memo(({
  message,
  isLast,
  onCopy,
  onCopyTool,
  onRetry
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const hasError = message.content.startsWith('错误:') || message.content.startsWith('Error:');
  const wasInterrupted = message.content.includes('[已停止]');

  return (
    <div
      className={`assistant-message group ${message.isStreaming ? 'streaming' : ''} ${hasError ? 'error' : ''} ${wasInterrupted ? 'interrupted' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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

          {/* 操作栏 - hover 显示 */}
          {isHovered && !message.isStreaming && (
            <MessageActions
              onCopy={() => onCopy?.(message.content)}
              onRetry={hasError || wasInterrupted ? () => onRetry?.(message.id) : undefined}
              position="top-right"
            />
          )}
        </div>

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
    </div>
  );
});

AssistantMessage.displayName = 'AssistantMessage';
