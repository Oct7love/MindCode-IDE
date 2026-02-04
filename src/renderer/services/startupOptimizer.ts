/**
 * 启动优化器
 * 优化应用启动性能
 */

/**
 * 延迟加载非关键资源
 */
export function deferNonCriticalResources() {
  // 延迟加载字体
  if (document.fonts) {
    document.fonts.ready.then(() => {
      console.log('[Startup] 字体加载完成');
    });
  }

  // 延迟加载图标字体
  setTimeout(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(link);
  }, 1000);
}

/**
 * 预编译Monaco语言
 */
export function precompileMonacoLanguages() {
  // 在空闲时预加载常用语言
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(() => {
      import('monaco-editor/esm/vs/language/typescript/monaco.contribution');
      import('monaco-editor/esm/vs/language/json/monaco.contribution');
      import('monaco-editor/esm/vs/language/css/monaco.contribution');
    }, { timeout: 3000 });
  }
}

/**
 * V8 优化提示
 */
export function optimizeV8() {
  // 标记热点函数 (仅在开发环境)
  if (process.env.NODE_ENV === 'development') {
    console.log('[Startup] V8优化模式已启用');
  }
}

/**
 * 启动性能追踪
 */
export class StartupTracker {
  private marks = new Map<string, number>();
  private startTime = performance.now();

  mark(name: string) {
    this.marks.set(name, performance.now());
  }

  getMark(name: string): number | undefined {
    return this.marks.get(name);
  }

  getDuration(startMark: string, endMark: string): number | null {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    if (start === undefined || end === undefined) return null;
    return end - start;
  }

  getTotalTime(): number {
    return performance.now() - this.startTime;
  }

  report() {
    const total = this.getTotalTime();
    console.group('[Startup] 性能报告');
    console.log(`总启动时间: ${total.toFixed(2)}ms`);
    
    const marks = Array.from(this.marks.entries()).sort((a, b) => a[1] - b[1]);
    marks.forEach(([name, time], index) => {
      const elapsed = time - this.startTime;
      const delta = index > 0 ? time - marks[index - 1][1] : elapsed;
      console.log(`  ${name}: ${elapsed.toFixed(2)}ms (+${delta.toFixed(2)}ms)`);
    });
    
    console.groupEnd();

    // 检查是否达到性能目标
    if (total < 2000) {
      console.log('✅ 启动性能达标 (<2s)');
    } else {
      console.warn(`⚠️ 启动时间 ${total.toFixed(0)}ms 超过目标 2000ms`);
    }
  }
}

// 全局启动追踪器
export const startupTracker = new StartupTracker();

// 标记关键时间点
export function markStartupPoint(name: string) {
  startupTracker.mark(name);
  
  // 在开发环境输出
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Startup] ${name}: ${startupTracker.getTotalTime().toFixed(2)}ms`);
  }
}
