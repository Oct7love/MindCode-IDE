/**
 * SendButton - 发送/停止按钮
 */
import React, { memo } from 'react';
import './SendButton.css';

interface SendButtonProps {
  isLoading: boolean;
  disabled: boolean;
  onSend: () => void;
  onStop: () => void;
}

export const SendButton: React.FC<SendButtonProps> = memo(({
  isLoading,
  disabled,
  onSend,
  onStop
}) => {
  if (isLoading) {
    return (
      <button
        className="send-button stop"
        onClick={onStop}
        type="button"
        aria-label="停止生成"
      >
        <span className="send-label">Stop</span>
        <span className="send-shortcut">Esc</span>
      </button>
    );
  }

  return (
    <button
      className="send-button send"
      onClick={onSend}
      disabled={disabled}
      type="button"
      aria-label="发送消息"
    >
      <span className="send-label">Send</span>
      <span className="send-shortcut">↵</span>
    </button>
  );
});

SendButton.displayName = 'SendButton';
