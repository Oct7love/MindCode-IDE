/**
 * LazyLoad - 懒加载工具
 */

import React, { ComponentType, lazy, Suspense, useState, useEffect, useRef } from 'react';

// ============ 组件懒加载 ============

interface LazyOptions { fallback?: React.ReactNode; errorFallback?: React.ReactNode; preload?: boolean; delay?: number; }

/** 创建懒加载组件 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: LazyOptions = {}
): React.FC<React.ComponentProps<T>> {
  const LazyComponent = lazy(importFn);

  const Wrapper: React.FC<React.ComponentProps<T>> = (props) => {
    const [error, setError] = useState<Error | null>(null);

    if (error) return <>{options.errorFallback || <div className="p-4 text-[var(--color-error)]">加载失败: {error.message}</div>}</>;

    return (
      <Suspense fallback={options.fallback || <LoadingFallback />}>
        <ErrorBoundary onError={setError}><LazyComponent {...props} /></ErrorBoundary>
      </Suspense>
    );
  };

  // 预加载
  if (options.preload) setTimeout(() => importFn(), options.delay || 0);

  return Wrapper;
}

/** 加载占位 */
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center p-4">
    <div className="w-5 h-5 border-2 border-[var(--color-accent-primary)] border-t-transparent rounded-full animate-spin" />
  </div>
);

/** 错误边界 */
class ErrorBoundary extends React.Component<{ children: React.ReactNode; onError: (error: Error) => void }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { this.props.onError(error); }
  render() { return this.state.hasError ? null : this.props.children; }
}

// ============ 图片懒加载 ============

export const LazyImage: React.FC<{ src: string; alt?: string; className?: string; placeholder?: string }> = ({ src, alt, className, placeholder }) => {
  const [loaded, setLoaded] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) { setInView(true); observer.disconnect(); } }, { rootMargin: '100px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`relative overflow-hidden ${className || ''}`}>
      {!loaded && <div className="absolute inset-0 bg-[var(--color-bg-secondary)] animate-pulse" />}
      {inView && <img src={src} alt={alt} onLoad={() => setLoaded(true)} className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`} />}
    </div>
  );
};

// ============ 虚拟列表 ============

interface VirtualListProps<T> { items: T[]; itemHeight: number; renderItem: (item: T, index: number) => React.ReactNode; overscan?: number; className?: string; }

export function VirtualList<T>({ items, itemHeight, renderItem, overscan = 3, className }: VirtualListProps<T>): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => setContainerHeight(entries[0].contentRect.height));
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan);
  const visibleItems = items.slice(startIndex, endIndex);

  return (
    <div ref={containerRef} className={`overflow-auto ${className || ''}`} onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}>
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map((item, i) => (
          <div key={startIndex + i} style={{ position: 'absolute', top: (startIndex + i) * itemHeight, height: itemHeight, width: '100%' }}>
            {renderItem(item, startIndex + i)}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ 分页加载 ============

interface InfiniteScrollProps { loadMore: () => Promise<void>; hasMore: boolean; loading?: boolean; children: React.ReactNode; loader?: React.ReactNode; threshold?: number; }

export const InfiniteScroll: React.FC<InfiniteScrollProps> = ({ loadMore, hasMore, loading, children, loader, threshold = 100 }) => {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hasMore || loading) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) loadMore(); }, { rootMargin: `${threshold}px` });
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading, threshold]);

  return (
    <>
      {children}
      <div ref={sentinelRef} />
      {loading && (loader || <LoadingFallback />)}
    </>
  );
};

// ============ 延迟渲染 ============

export const DeferredRender: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const [show, setShow] = useState(delay === 0);
  useEffect(() => { if (delay > 0) { const id = setTimeout(() => setShow(true), delay); return () => clearTimeout(id); } }, [delay]);
  return show ? <>{children}</> : null;
};

// ============ 预加载管理 ============

const preloadQueue: (() => Promise<any>)[] = [];
let preloading = false;

export const addToPreloadQueue = (importFn: () => Promise<any>) => {
  preloadQueue.push(importFn);
  if (!preloading) processPreloadQueue();
};

const processPreloadQueue = async () => {
  preloading = true;
  while (preloadQueue.length > 0) {
    const fn = preloadQueue.shift()!;
    try { await fn(); } catch {}
    await new Promise(r => requestIdleCallback(() => r(undefined)));
  }
  preloading = false;
};

export default { createLazyComponent, LazyImage, VirtualList, InfiniteScroll, DeferredRender, addToPreloadQueue };
