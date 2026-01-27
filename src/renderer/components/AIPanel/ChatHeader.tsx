/**
 * ChatHeader - 聊天面板顶部工具栏
 */
import React, { memo } from 'react';
import { useAIStore } from '../../stores';

interface ChatHeaderProps {
  onNewChat: () => void;
  onShowHistory: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = memo(({ onNewChat, onShowHistory }) => {
  const { getCurrentConversation } = useAIStore();
  const conversation = getCurrentConversation();

  return (
    <div className="unified-header">
      <div className="unified-header-left">
        <span className="unified-header-title">{conversation?.title || '新对话'}</span>
      </div>
      <div className="unified-header-right">
        <button className="unified-header-btn" onClick={onNewChat} title="新建对话">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M8 2a.5.5 0 01.5.5v5h5a.5.5 0 010 1h-5v5a.5.5 0 01-1 0v-5h-5a.5.5 0 010-1h5v-5A.5.5 0 018 2z"/>
          </svg>
        </button>
        <button className="unified-header-btn" onClick={onShowHistory} title="历史对话">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M1.5 2.5A1.5 1.5 0 013 1h10a1.5 1.5 0 011.5 1.5v12a.5.5 0 01-.84.37L11 12.5H3a1.5 1.5 0 01-1.5-1.5v-8.5zm1 0V11a.5.5 0 00.5.5h8.5l2 2v-11a.5.5 0 00-.5-.5H3a.5.5 0 00-.5.5z"/>
          </svg>
        </button>
      </div>
    </div>
  );
});

ChatHeader.displayName = 'ChatHeader';
