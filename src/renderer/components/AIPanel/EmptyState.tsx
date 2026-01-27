/**
 * EmptyState - 空状态占位
 */
import React, { memo } from 'react';
import { AIMode } from '../../stores';

interface EmptyStateProps {
  mode: AIMode;
  icon: string;
  label: string;
}

export const EmptyState: React.FC<EmptyStateProps> = memo(({ icon, label }) => {
  return (
    <div className="unified-empty">
      <div className="unified-empty-icon">{icon}</div>
      <div className="unified-empty-title">{label}</div>
    </div>
  );
});

EmptyState.displayName = 'EmptyState';
