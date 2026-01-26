import React, { memo } from 'react';
import './QuickActions.css';

interface Props { onAction: (action: string, prompt: string) => void; disabled?: boolean; }

const ACTIONS = [
  { id: 'explain', label: '解释', icon: '💡', prompt: '请解释这段代码的作用和原理：' },
  { id: 'refactor', label: '重构', icon: '🔧', prompt: '请重构这段代码，提高可读性和性能：' },
  { id: 'fix', label: '修复', icon: '🐛', prompt: '请修复这段代码中的问题：' },
  { id: 'test', label: '测试', icon: '🧪', prompt: '请为这段代码生成单元测试：' },
  { id: 'optimize', label: '优化', icon: '⚡', prompt: '请优化这段代码的性能：' },
  { id: 'docs', label: '文档', icon: '📝', prompt: '请为这段代码添加详细注释和文档：' },
];

export const QuickActions: React.FC<Props> = memo(({ onAction, disabled }) => (
  <div className="quick-actions">
    {ACTIONS.map(a => (
      <button key={a.id} className="quick-action-btn" onClick={() => onAction(a.id, a.prompt)} disabled={disabled} title={a.prompt}>
        <span className="quick-action-icon">{a.icon}</span>
        <span className="quick-action-label">{a.label}</span>
      </button>
    ))}
  </div>
));
