/**
 * useScrollAnchor - 消息列表滚动锚定（智能版）
 * 
 * 特性：
 * - 用户在底部时：自动滚动跟随新内容
 * - 用户主动向上滚动：暂停自动滚动，允许查看历史
 * - 提供"回到底部"状态
 */
import { useRef, useEffect, useState, useCallback } from 'react';

interface ScrollAnchorOptions {
  dependencies: any[];
  behavior?: ScrollBehavior;
  /** 距离底部多少像素内视为"在底部" */
  threshold?: number;
}

export function useScrollAnchor(options: ScrollAnchorOptions) {
  const { dependencies, behavior = 'smooth', threshold = 100 } = options;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 用户是否在底部（用于决定是否自动滚动）
  const [isAtBottom, setIsAtBottom] = useState(true);
  // 是否显示"回到底部"按钮
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  
  // 用户是否正在手动滚动（防抖标记）
  const userScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 检测是否在底部
  const checkIsAtBottom = useCallback(() => {
    const container = containerRef.current;
    if (!container) return true;
    
    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    return distanceFromBottom <= threshold;
  }, [threshold]);

  // 滚动到底部
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ 
      behavior: smooth ? 'smooth' : 'auto' 
    });
    setIsAtBottom(true);
    setShowScrollToBottom(false);
  }, []);

  // 处理滚动事件
  const handleScroll = useCallback(() => {
    // 标记用户正在滚动
    userScrollingRef.current = true;
    
    // 清除之前的超时
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    
    // 检查是否在底部
    const atBottom = checkIsAtBottom();
    setIsAtBottom(atBottom);
    setShowScrollToBottom(!atBottom);
    
    // 滚动结束后重置标记
    scrollTimeoutRef.current = setTimeout(() => {
      userScrollingRef.current = false;
    }, 150);
  }, [checkIsAtBottom]);

  // 监听容器滚动
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  // 内容变化时，只有在底部才自动滚动
  useEffect(() => {
    // 如果用户正在滚动，不干扰
    if (userScrollingRef.current) return;
    
    // 只有在底部时才自动滚动
    if (isAtBottom) {
      // 使用 requestAnimationFrame 避免滚动冲突
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior });
      });
    }
  }, dependencies);

  return { 
    messagesEndRef, 
    containerRef,
    isAtBottom,
    showScrollToBottom,
    scrollToBottom
  };
}
