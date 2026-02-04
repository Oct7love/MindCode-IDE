/**
 * 懒加载组件工厂
 * 优化启动性能,按需加载组件
 */

import React, { lazy, Suspense } from 'react';

/**
 * 创建懒加载组件
 */
export function createLazyComponent<T extends React.ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  fallback?: React.ReactNode
) {
  const LazyComponent = lazy(loader);

  return (props: React.ComponentProps<T>) => (
    <Suspense fallback={fallback || <LoadingFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

/**
 * 默认加载占位符
 */
function LoadingFallback() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      color: 'var(--color-text-muted)',
      fontSize: '12px'
    }}>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px'
      }}>
        <div className="spinner" style={{
          width: '24px',
          height: '24px',
          border: '2px solid transparent',
          borderTopColor: 'var(--color-accent-blue)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite'
        }} />
        <span>Loading...</span>
      </div>
    </div>
  );
}

/**
 * 懒加载的组件列表
 */
export const LazyComponents = {
  // 重量级组件懒加载
  ComposerPanel: createLazyComponent(() => import('../components/ComposerPanel')),
  ExtensionMarketplace: createLazyComponent(() => import('../components/ExtensionMarketplace')),
  DebugPanel: createLazyComponent(() => import('../components/Debugger/DebugPanel')),
  GitPanel: createLazyComponent(() => import('../components/GitPanel')),
  PluginPanel: createLazyComponent(() => import('../components/PluginPanel')),
  
  // 设置相关
  SettingsPanel: createLazyComponent(() => import('../components/SettingsPanel')),
  ThemeManager: createLazyComponent(() => import('../components/ThemeManager')),
  KeybindingManager: createLazyComponent(() => import('../components/KeybindingManager')),
  
  // 工具面板
  PerformancePanel: createLazyComponent(() => import('../components/PerformancePanel')),
  TaskRunner: createLazyComponent(() => import('../components/TaskRunner')),
};

/**
 * 预加载关键组件
 * 在空闲时预加载,提升后续体验
 */
export function preloadCriticalComponents() {
  if (typeof window === 'undefined') return;

  // 使用requestIdleCallback在浏览器空闲时预加载
  const preload = () => {
    // 预加载常用组件
    import('../components/GitPanel');
    import('../components/PluginPanel');
    import('../components/SettingsPanel');
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(preload, { timeout: 2000 });
  } else {
    setTimeout(preload, 1000);
  }
}

/**
 * 预加载AI相关组件
 */
export function preloadAIComponents() {
  if (typeof window === 'undefined') return;

  const preload = () => {
    import('../components/ComposerPanel');
    import('../components/AIPanel');
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(preload, { timeout: 3000 });
  } else {
    setTimeout(preload, 1500);
  }
}
