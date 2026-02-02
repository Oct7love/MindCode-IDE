import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';

// 虚拟列表组件 - 优化大列表渲染性能
interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number; // 可视区域外额外渲染的项数
  className?: string;
  style?: React.CSSProperties;
}

export function VirtualList<T>({ items, itemHeight, renderItem, overscan = 5, className, style }: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  // 监听容器尺寸变化
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) setContainerHeight(entry.contentRect.height);
    });
    observer.observe(container);
    setContainerHeight(container.clientHeight);
    return () => observer.disconnect();
  }, []);

  // 滚动处理 (使用 passive 优化)
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // 计算可见范围
  const { startIndex, endIndex, visibleItems, offsetY } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
    const end = Math.min(items.length, start + visibleCount);
    return {
      startIndex: start,
      endIndex: end,
      visibleItems: items.slice(start, end),
      offsetY: start * itemHeight,
    };
  }, [items, itemHeight, scrollTop, containerHeight, overscan]);

  const totalHeight = items.length * itemHeight;

  return (
    <div ref={containerRef} className={className} style={{ ...style, overflow: 'auto', position: 'relative' }} onScroll={handleScroll}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(item, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 简化版: 固定高度虚拟滚动 Hook
export function useVirtualScroll<T>(items: T[], itemHeight: number, containerHeight: number, scrollTop: number, overscan = 5) {
  return useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight) + 2 * overscan;
    const end = Math.min(items.length, start + visibleCount);
    return { startIndex: start, endIndex: end, visibleItems: items.slice(start, end), offsetY: start * itemHeight, totalHeight: items.length * itemHeight };
  }, [items, itemHeight, containerHeight, scrollTop, overscan]);
}

export default VirtualList;
