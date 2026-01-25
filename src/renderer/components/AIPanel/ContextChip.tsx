import React from 'react';
import { ContextItem } from '../../stores';
import './ContextChip.css';

export type { ContextItem }; // 重新导出以保持向后兼容

interface ContextChipProps {
  item: ContextItem;
  onRemove: () => void;
}

export const ContextChip: React.FC<ContextChipProps> = ({ item, onRemove }) => {
  const icons: Record<string, string> = { file: '📄', selection: '✂️', folder: '📁', symbol: '🔣', error: '⚠️', terminal: '💻', diff: '🔀' };
  const getIcon = () => icons[item.type] || '📎';

  return (
    <div className={`ai-context-chip type-${item.type} ${item.locked ? 'locked' : ''}`}>
      <span className="ai-context-chip-icon">{getIcon()}</span>
      <span className="ai-context-chip-label" title={item.label}>
        {item.label}
      </span>
      {!item.locked && (
        <button
          className="ai-context-chip-remove"
          onClick={onRemove}
          title="移除"
        >
          ×
        </button>
      )}
    </div>
  );
};
