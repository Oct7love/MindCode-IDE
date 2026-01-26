import React from 'react';
import { useAIStore } from '../../stores';
import { UnifiedChatView } from './UnifiedChatView';
import './AIPanel.css';

interface AIPanelProps { model: string; onModelChange: (model: string) => void; onClose: () => void; width: number; }

export const AIPanel: React.FC<AIPanelProps> = ({ onClose, width }) => {
  const { isPinned, setPinned, createConversation } = useAIStore();

  return (
    <div className="ai-panel-v2" style={{ width }}>
      <div className="ai-panel-header">
        <div className="ai-panel-header-left">
          <div className="ai-panel-header-icon"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 .5L9.13 5.03 13.5 6 9.13 6.97 8 11.5 6.87 6.97 2.5 6l4.37-.97L8 .5z"/></svg></div>
          <span className="ai-panel-header-title">MindCode AI</span>
        </div>
        <div className="ai-panel-header-actions">
          <button className="ai-panel-header-btn" title="新对话" onClick={createConversation}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zM7.25 4v3.25H4v1.5h3.25V12h1.5V8.75H12v-1.5H8.75V4h-1.5z"/></svg>
          </button>
          <button className={`ai-panel-header-btn ${isPinned ? 'active' : ''}`} title={isPinned ? '取消固定' : '固定'} onClick={() => setPinned(!isPinned)}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z"/></svg>
          </button>
          <button className="ai-panel-header-btn" title="关闭" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/></svg>
          </button>
        </div>
      </div>
      <UnifiedChatView />
    </div>
  );
};
