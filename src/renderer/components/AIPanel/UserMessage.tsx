/**
 * UserMessage - 用户消息组件
 * 右对齐的简洁卡片风格
 */
import React, { memo, useState } from 'react';
import { MessageActions } from './MessageActions';
import './UserMessage.css';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface UserMessageProps {
  message: Message;
  onCopy?: (content: string) => void;
  onEdit?: (messageId: string) => void;
}

export const UserMessage: React.FC<UserMessageProps> = memo(({
  message,
  onCopy,
  onEdit
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="user-message group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="message-wrapper">
        {/* 操作栏 - hover 显示在左侧 */}
        {isHovered && (
          <MessageActions
            onCopy={() => onCopy?.(message.content)}
            onEdit={onEdit ? () => onEdit(message.id) : undefined}
            position="left"
            compact
          />
        )}

        {/* 消息卡片 */}
        <div className="message-card">
          <div className="message-content">
            {message.content}
          </div>
        </div>
      </div>

      {/* 头像 */}
      <div className="message-avatar message-avatar-user">
        <span className="avatar-icon">◯</span>
      </div>
    </div>
  );
});

UserMessage.displayName = 'UserMessage';
