import React, { useEffect } from 'react';
import { useAIStore, AIMode } from '../../stores';
import { ChatView } from './ChatView';
import { PlanView } from './PlanView';
import { AgentView } from './AgentView';
import { DebugView } from './DebugView';
import { ContextChip } from './ContextChip';
import './AIPanel.css';

interface AIPanelProps {
  model: string;
  onModelChange: (model: string) => void;
  onClose: () => void;
  width: number;
}

export const AIPanel: React.FC<AIPanelProps> = ({ model, onModelChange, onClose, width }) => {
  const { mode, setMode, setModel, contexts, removeContext, isPinned, setPinned, currentPlan, debugInfo } = useAIStore();
  
  useEffect(() => { setModel(model); }, [model, setModel]); // 同步模型到 store

  const handleModeChange = (newMode: AIMode) => {
    if (mode === 'chat' && newMode === 'agent' && !currentPlan) return; // 需要先有 Plan
    setMode(newMode);
  };

  const hasError = !!debugInfo;

  return (
    <div className="ai-panel-v2" style={{ width }}>
      {/* Header */}
      <div className="ai-panel-header">
        <div className="ai-panel-header-icon">
          <svg viewBox="0 0 16 16" fill="white">
            <path d="M8 .5L9.13 5.03 13.5 6 9.13 6.97 8 11.5 6.87 6.97 2.5 6l4.37-.97L8 .5z"/>
          </svg>
        </div>
        <div className="ai-panel-header-title">MindCode AI</div>
        <div className="ai-panel-header-actions">
          <button
            className="ai-panel-header-btn badge"
            title="上下文"
            onClick={() => {/* TODO: 打开上下文选择器 */}}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0zM7 11.5L4.5 9 5.914 7.586 7 8.672l3.586-3.586L12 6.672z"/>
            </svg>
            {contexts.length > 0 && <span style={{ fontSize: '10px', marginLeft: '4px' }}>{contexts.length}</span>}
          </button>
          <button
            className="ai-panel-header-btn"
            title="历史会话"
            onClick={() => {/* TODO: 打开历史 */}}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M13.5 8a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0zM8 2.5A5.5 5.5 0 0 0 2.5 8a.5.5 0 0 1-1 0 6.5 6.5 0 1 1 6.5 6.5.5.5 0 0 1 0-1A5.5 5.5 0 0 0 8 2.5z"/>
            </svg>
          </button>
          <button
            className={`ai-panel-header-btn ${isPinned ? 'active' : ''}`}
            title={isPinned ? '取消固定' : '固定面板'}
            onClick={() => setPinned(!isPinned)}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 0l1.5 1.5L7 5h5l-1.5 1.5L8 3v5l1.5-1.5L12 10l-1.5 1.5L8 9v5l1.5-1.5L13 15H3l1.5-1.5L6 10l1.5-1.5L6 8h5l-2.5-3.5L10 1.5z"/>
            </svg>
          </button>
          <button
            className="ai-panel-header-btn"
            title="关闭"
            onClick={onClose}
          >
            <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
              <path d="M8 8.707l3.646 3.647.708-.707L8.707 8l3.647-3.646-.707-.708L8 7.293 4.354 3.646l-.707.708L7.293 8l-3.646 3.646.707.708L8 8.707z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Mode Switcher */}
      <div className="ai-mode-switcher">
        <button className={`ai-mode-tab ${mode === 'chat' ? 'active' : ''}`} onClick={() => handleModeChange('chat')}>Chat</button>
        <button className={`ai-mode-tab ${mode === 'plan' ? 'active' : ''}`} onClick={() => handleModeChange('plan')}>Plan</button>
        <button className={`ai-mode-tab ${mode === 'agent' ? 'active' : ''}`} onClick={() => handleModeChange('agent')}>Agent</button>
        <button className={`ai-mode-tab ${mode === 'debug' ? 'active' : ''} ${hasError ? 'badge' : ''}`} onClick={() => handleModeChange('debug')}>Debug</button>
      </div>

      {/* Context Area */}
      {contexts.length > 0 && (
        <div className="ai-context-area">
          {contexts.map(ctx => (
            <ContextChip
              key={ctx.id}
              item={ctx}
              onRemove={() => removeContext(ctx.id)}
            />
          ))}
        </div>
      )}

      {/* Content Area */}
      {mode === 'chat' && <ChatView model={model} onModelChange={onModelChange} contexts={contexts} />}
      {mode === 'plan' && <PlanView />}
      {mode === 'agent' && <AgentView />}
      {mode === 'debug' && <DebugView />}
    </div>
  );
};
