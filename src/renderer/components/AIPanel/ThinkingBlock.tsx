/**
 * ThinkingBlock - AI 思考过程可视化组件 (Cursor 风格)
 *
 * 特性:
 * - 小字体、灰色、等宽字体 - 区别于正式回答
 * - 左侧强调线 - 视觉分隔
 * - 折叠/展开手风琴设计
 * - 流式输出时默认展开
 * - 完成后平滑过渡到折叠状态（不会突然消失）
 */
import React, { memo, useState, useEffect, useRef } from 'react';
import './ThinkingBlock.css';

interface ThinkingBlockProps {
  /** 思考内容文本 */
  content: string;
  /** 是否正在思考（流式输出中） */
  isThinking: boolean;
  /** 完成后自动折叠延迟（毫秒），0 表示不自动折叠 */
  autoCollapseDelay?: number;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = memo(({
  content,
  isThinking,
  autoCollapseDelay = 800 // 默认 0.8 秒后自动折叠
}) => {
  const [isExpanded, setIsExpanded] = useState(isThinking); // 初始状态：思考中展开，已完成折叠
  const [isTransitioning, setIsTransitioning] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const wasThinkingRef = useRef(false);

  // 清理思考标签（移到最前面）
  const displayContent = content.replace(/<\/?thinking>/gi, '').trim();

  // 流式输出时自动滚动到底部
  useEffect(() => {
    if (isThinking && isExpanded && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isThinking, isExpanded]);

  // 流式输出时强制展开
  useEffect(() => {
    if (isThinking) {
      setIsExpanded(true);
      wasThinkingRef.current = true;
    }
  }, [isThinking]);

  // 思考完成后，延迟自动折叠（带过渡动画）
  useEffect(() => {
    if (!isThinking && wasThinkingRef.current && autoCollapseDelay > 0 && displayContent) {
      // 先显示过渡状态
      setIsTransitioning(true);
      
      const timer = setTimeout(() => {
        setIsExpanded(false);
        setIsTransitioning(false);
        wasThinkingRef.current = false;
      }, autoCollapseDelay);
      
      return () => clearTimeout(timer);
    }
  }, [isThinking, autoCollapseDelay, displayContent]);

  // 无内容时不渲染
  if (!displayContent && !isThinking) return null;

  const toggleExpanded = () => {
    if (!isThinking) {
      setIsExpanded(prev => !prev);
    }
  };

  // 计算思考摘要
  const summary = displayContent.length > 40
    ? displayContent.slice(0, 40).replace(/\n/g, ' ').replace(/[-*]/g, '').trim() + '...'
    : displayContent.replace(/\n/g, ' ').replace(/[-*]/g, '').trim();

  return (
    <div className={`thinking-block ${isThinking ? 'thinking' : 'done'} ${isExpanded ? 'expanded' : 'collapsed'} ${isTransitioning ? 'transitioning' : ''}`}>
      {/* 头部 */}
      <div
        className="thinking-header"
        onClick={toggleExpanded}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onKeyDown={(e) => e.key === 'Enter' && toggleExpanded()}
      >
        <div className="thinking-icon-wrapper">
          {isThinking ? (
            <span className="thinking-icon pulse">🧠</span>
          ) : (
            <span className={`thinking-chevron`}>
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
        </div>

        <div className="thinking-title">
          {isThinking ? (
            <span className="thinking-status">
              Thinking
              <span className="thinking-dots">
                <span>.</span><span>.</span><span>.</span>
              </span>
            </span>
          ) : (
            <span className="thinking-summary">
              Analysis {!isExpanded && summary && <span className="summary-text">— {summary}</span>}
            </span>
          )}
        </div>

        {!isThinking && (
          <span className="thinking-hint">
            {isExpanded ? 'collapse' : 'expand'}
          </span>
        )}
      </div>

      {/* 内容区 - 纯文本渲染，保持简洁 */}
      <div
        ref={contentRef}
        className={`thinking-content ${isExpanded ? 'show' : 'hide'}`}
        aria-hidden={!isExpanded}
      >
        {displayContent || (isThinking ? 'Analyzing...' : '')}
        {isThinking && <span className="thinking-cursor" />}
      </div>
    </div>
  );
});

ThinkingBlock.displayName = 'ThinkingBlock';
