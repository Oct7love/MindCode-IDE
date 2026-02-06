/**
 * EmptyState - 空状态欢迎界面（优化版）
 * 精致的 AI 品牌感 + 快捷操作引导
 */
import React, { memo } from 'react';
import { AIMode, useAIStore } from '../../stores';
import { MODELS } from './ModelPicker';
import './EmptyState.css';

interface EmptyStateProps {
  mode: AIMode;
  icon: string;
  label: string;
}

const QUICK_ACTIONS = [
  { icon: '💡', text: '代码建议与最佳实践', color: '#f59e0b' },
  { icon: '🔍', text: '搜索与语义分析', color: '#3b82f6' },
  { icon: '🔧', text: '调试与问题排查', color: '#ef4444' },
  { icon: '📝', text: '代码编写与重构', color: '#10b981' },
];

export const EmptyState: React.FC<EmptyStateProps> = memo(({ mode }) => {
  const { model } = useAIStore();
  
  const getModelDisplayName = () => {
    const modelInfo = MODELS.find(m => m.id === model);
    return modelInfo?.name || 'AI Assistant';
  };
  
  const getModelProvider = () => {
    const modelInfo = MODELS.find(m => m.id === model);
    return modelInfo?.provider || 'AI';
  };

  const getGreeting = () => {
    const modelName = getModelDisplayName();
    switch (mode) {
      case 'agent': return { title: 'Agent Mode', desc: `${modelName} 可以自主执行多步骤开发任务` };
      case 'plan': return { title: 'Plan Mode', desc: `让 ${modelName} 帮你制定详细的任务计划` };
      case 'debug': return { title: 'Debug Mode', desc: `${modelName} 专注于代码调试和问题排查` };
      default: return { title: `Hi, I'm ${modelName}`, desc: '我可以帮你编写、分析和优化代码' };
    }
  };

  const greeting = getGreeting();

  return (
    <div className="empty-state">
      {/* 品牌区域 */}
      <div className="empty-state-brand">
        <div className="empty-state-logo-ring">
          <div className="empty-state-logo">
            <svg viewBox="0 0 32 32" width="32" height="32">
              <defs>
                <linearGradient id="emptyAiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="50%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
              </defs>
              <path fill="url(#emptyAiGrad)" d="M16 2L18.6 11.4 28 14 18.6 16.6 16 26 13.4 16.6 4 14l9.4-2.6L16 2z"/>
            </svg>
          </div>
        </div>
        <h2 className="empty-state-title">{greeting.title}</h2>
        <p className="empty-state-desc">{greeting.desc}</p>
      </div>

      {/* 快捷操作网格 */}
      <div className="empty-state-actions">
        {QUICK_ACTIONS.map((action, idx) => (
          <div key={idx} className="empty-state-action-card">
            <span className="empty-state-action-icon">{action.icon}</span>
            <span className="empty-state-action-text">{action.text}</span>
          </div>
        ))}
      </div>

      {/* 底部提示 */}
      <div className="empty-state-hint">
        <span className="empty-state-hint-kbd">Enter</span> 发送消息
        <span className="empty-state-hint-sep">·</span>
        <span className="empty-state-hint-kbd">Shift+Enter</span> 换行
        <span className="empty-state-hint-sep">·</span>
        <span className="empty-state-hint-kbd">@</span> 添加上下文
      </div>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';
