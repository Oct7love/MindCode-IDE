/**
 * 预加载工具
 * 在空闲时预加载组件,优化性能
 */

/**
 * 预加载关键组件
 */
export function preloadCriticalComponents() {
  if (typeof window === 'undefined') return;

  const preload = () => {
    // 预加载常用组件
    import('../components/GitPanel').catch(() => {});
    import('../components/PluginPanel').catch(() => {});
    import('../components/SettingsPanel').catch(() => {});
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
    import('../components/ComposerPanel').catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(preload, { timeout: 3000 });
  } else {
    setTimeout(preload, 1500);
  }
}
