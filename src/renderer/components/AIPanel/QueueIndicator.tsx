/**
 * QueueIndicator - 消息队列指示器
 */
import React, { memo } from 'react';

interface QueueIndicatorProps {
  count: number;
  onClear: () => void;
}

export const QueueIndicator: React.FC<QueueIndicatorProps> = memo(({ count, onClear }) => {
  if (count === 0) return null;

  return (
    <div className="unified-queue-indicator">
      <span className="unified-queue-icon">📝</span>
      <span className="unified-queue-text">{count} 条消息排队中</span>
      <button className="unified-queue-clear" onClick={onClear} title="清空队列">✕</button>
    </div>
  );
});

QueueIndicator.displayName = 'QueueIndicator';
