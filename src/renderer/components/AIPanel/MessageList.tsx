/**
 * MessageList - 消息列表容器
 * Cursor 风格的消息区域，支持滚动、空状态、加载状态
 */
import React, { memo, forwardRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { EmptyState } from "./EmptyState";
import { TypingIndicator } from "./TypingIndicator";
import type { AIMode } from "../../stores";
import "./MessageList.css";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  mode?: AIMode;
  toolCalls?: any[];
  plan?: any;
  isStreaming?: boolean;
}

interface MessageListProps {
  messages: Message[];
  mode: AIMode;
  modeIcon: string;
  modeLabel: string;
  isLoading: boolean;
  streamingText: string;
  onCopyMessage?: (content: string) => void;
  onCopyTool?: (content: string) => void;
  onRetry?: (messageId: string) => void;
}

export const MessageList = memo(
  forwardRef<HTMLDivElement, MessageListProps>(
    (
      {
        messages,
        mode,
        modeIcon,
        modeLabel,
        isLoading,
        streamingText,
        onCopyMessage,
        onCopyTool,
        onRetry,
      },
      ref,
    ) => {
      const displayMessages = messages.slice(1); // 跳过 system 消息
      const isEmpty = displayMessages.length === 0;

      return (
        <div className="message-list" role="log" aria-label="对话消息">
          {isEmpty && !isLoading && <EmptyState mode={mode} icon={modeIcon} label={modeLabel} />}

          <div className="message-list-content">
            {displayMessages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={idx === displayMessages.length - 1}
                onCopy={onCopyMessage}
                onCopyTool={onCopyTool}
                onRetry={onRetry}
              />
            ))}

            {isLoading && !streamingText && (
              <div className="message-loading">
                <div className="message-avatar message-avatar-ai">
                  <span className="avatar-icon">✦</span>
                </div>
                <TypingIndicator variant="dots" size="md" />
              </div>
            )}
          </div>

          <div ref={ref} className="message-list-anchor" />
        </div>
      );
    },
  ),
);

MessageList.displayName = "MessageList";
