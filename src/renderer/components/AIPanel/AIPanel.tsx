import React, { useState } from 'react';
import { UnifiedChatView } from './UnifiedChatView';
import { ConversationList } from './ConversationList';
import { useAIStore } from '../../stores';
import './AIPanel.css';

interface AIPanelProps {
  onClose: () => void;
  width: number;
  isResizing?: boolean;
}

export const AIPanel: React.FC<AIPanelProps> = ({ onClose, width, isResizing }) => {
  const [showHistory, setShowHistory] = useState(false);
  const { createConversation, getCurrentConversation } = useAIStore();
  const conversation = getCurrentConversation();

  return (
    <div className="ai-panel" style={{ width }}>
      <div className="ai-panel-header">
        <div className="ai-panel-header-left">
          <div className="ai-panel-header-icon">
            <svg viewBox="0 0 16 16" width="13" height="13" fill="white">
              <path d="M8 1L9.3 5.7 14 7l-4.7 1.3L8 13l-1.3-4.7L2 7l4.7-1.3L8 1z"/>
            </svg>
          </div>
          <span className="ai-panel-header-title">
            {conversation?.title || 'AI Chat'}
          </span>
        </div>
        <div className="ai-panel-header-actions">
          <button className="ai-panel-btn" title="新建对话" onClick={createConversation}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="3" y="3" width="10" height="10" rx="2" />
              <line x1="8" y1="5.5" x2="8" y2="10.5" />
              <line x1="5.5" y1="8" x2="10.5" y2="8" />
            </svg>
          </button>
          <button className={`ai-panel-btn ${showHistory ? 'active' : ''}`} title="历史对话" onClick={() => setShowHistory(!showHistory)}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="8" cy="8" r="5.5" />
              <polyline points="8,4.5 8,8 10.5,9.5" />
            </svg>
          </button>
          <button className="ai-panel-btn close" title="关闭面板" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <line x1="4.5" y1="4.5" x2="11.5" y2="11.5" />
              <line x1="11.5" y1="4.5" x2="4.5" y2="11.5" />
            </svg>
          </button>
        </div>
      </div>

      <UnifiedChatView isResizing={isResizing} />
      <ConversationList isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </div>
  );
};
