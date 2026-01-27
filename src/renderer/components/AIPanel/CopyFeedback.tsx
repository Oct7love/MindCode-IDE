import React, { useState, useEffect, useCallback, memo } from 'react';
import './CopyFeedback.css';

interface CopyFeedbackProps {
  show: boolean;
  message?: string;
  position?: 'top' | 'bottom' | 'cursor';
  duration?: number;
  onHide?: () => void;
}

export const CopyFeedback: React.FC<CopyFeedbackProps> = memo(({
  show,
  message = '已复制到剪贴板',
  position = 'bottom',
  duration = 2000,
  onHide
}) => {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      setLeaving(false);

      const hideTimer = setTimeout(() => {
        setLeaving(true);
        setTimeout(() => {
          setVisible(false);
          onHide?.();
        }, 200);
      }, duration);

      return () => clearTimeout(hideTimer);
    }
  }, [show, duration, onHide]);

  if (!visible) return null;

  return (
    <div className={`copy-feedback copy-feedback-${position} ${leaving ? 'leaving' : ''}`}>
      <span className="copy-feedback-icon">✓</span>
      <span className="copy-feedback-message">{message}</span>
    </div>
  );
});

CopyFeedback.displayName = 'CopyFeedback';

// 全局复制函数，带反馈
interface CopyOptions {
  content: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export async function copyToClipboard({ content, onSuccess, onError }: CopyOptions): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(content);
    onSuccess?.();
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    onError?.(error as Error);
    return false;
  }
}

// 使用 Hook
export function useCopyFeedback() {
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('已复制到剪贴板');

  const copy = useCallback(async (content: string, message?: string) => {
    const success = await copyToClipboard({ content });
    if (success) {
      setFeedbackMessage(message || '已复制到剪贴板');
      setShowFeedback(true);
    }
    return success;
  }, []);

  const hideFeedback = useCallback(() => {
    setShowFeedback(false);
  }, []);

  return {
    copy,
    showFeedback,
    feedbackMessage,
    hideFeedback,
    FeedbackComponent: (
      <CopyFeedback
        show={showFeedback}
        message={feedbackMessage}
        onHide={hideFeedback}
      />
    )
  };
}
