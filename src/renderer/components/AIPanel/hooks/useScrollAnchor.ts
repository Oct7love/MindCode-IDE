/**
 * useScrollAnchor - 消息列表滚动锚定
 * 新消息时自动滚动到底部
 */
import { useRef, useEffect } from 'react';

interface ScrollAnchorOptions {
  dependencies: any[];
  behavior?: ScrollBehavior;
}

export function useScrollAnchor(options: ScrollAnchorOptions) {
  const { dependencies, behavior = 'smooth' } = options;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, dependencies);

  return { messagesEndRef };
}
