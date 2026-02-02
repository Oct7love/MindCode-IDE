import React from 'react';
import { UnifiedChatView } from './UnifiedChatView';
import './AIPanel.css';

interface AIPanelProps {
  model: string;
  onModelChange: (model: string) => void;
  onClose: () => void;
  width: number;
  isResizing?: boolean;
}

export const AIPanel: React.FC<AIPanelProps> = ({ onClose, width, isResizing }) => {
  return (
    <div className="ai-panel" style={{ width }}>
      <div className="ai-panel-header">
        <div className="ai-panel-header-left">
          <div className="ai-panel-header-icon">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 .5L9.13 5.03 13.5 6 9.13 6.97 8 11.5 6.87 6.97 2.5 6l4.37-.97L8 .5z"/>
            </svg>
          </div>
          <span className="ai-panel-header-title">MindCode AI</span>
        </div>
        <div className="ai-panel-header-actions">
          <button className="ai-panel-header-btn" title="关闭" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
              <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
            </svg>
          </button>
        </div>
      </div>
      <UnifiedChatView isResizing={isResizing} />
    </div>
  );
};
