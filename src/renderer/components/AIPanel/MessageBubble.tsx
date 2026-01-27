/**
 * MessageBubble - 消息分发路由
 * 根据 role 分发到 AssistantMessage 或 UserMessage
 */
import React, { memo } from 'react';
import { AssistantMessage } from './AssistantMessage';
import { UserMessage } from './UserMessage';
import { AIMode } from '../../stores';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  mode?: AIMode;
  toolCalls?: any[];
  plan?: any;
  isStreaming?: boolean;
}

interface MessageBubbleProps {
  message: Message;
  isLast: boolean;
  onCopy?: (content: string) => void;
  onCopyTool?: (content: string) => void;
  onRetry?: (messageId: string) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = memo(({
  message,
  isLast,
  onCopy,
  onCopyTool,
  onRetry
}) => {
  if (message.role === 'system') return null;

  if (message.role === 'user') {
    return (
      <UserMessage
        message={message}
        onCopy={onCopy}
      />
    );
  }

  return (
    <AssistantMessage
      message={message}
      isLast={isLast}
      onCopy={onCopy}
      onCopyTool={onCopyTool}
      onRetry={onRetry}
    />
  );
});

MessageBubble.displayName = 'MessageBubble';
