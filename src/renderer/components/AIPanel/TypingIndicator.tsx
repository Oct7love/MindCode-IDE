import React, { memo } from 'react';
import './TypingIndicator.css';

interface TypingIndicatorProps {
  variant?: 'dots' | 'pulse' | 'cursor';
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = memo(({
  variant = 'dots',
  size = 'md',
  label
}) => {
  if (variant === 'cursor') {
    return (
      <span className={`typing-indicator typing-cursor typing-${size}`}>
        <span className="typing-cursor-block">▊</span>
      </span>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={`typing-indicator typing-pulse typing-${size}`}>
        <div className="typing-pulse-ring" />
        <div className="typing-pulse-dot" />
        {label && <span className="typing-label">{label}</span>}
      </div>
    );
  }

  // Default: dots
  return (
    <div className={`typing-indicator typing-dots typing-${size}`}>
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
      {label && <span className="typing-label">{label}</span>}
    </div>
  );
});

TypingIndicator.displayName = 'TypingIndicator';
