/**
 * Bootstrap - 应用启动服务
 */

import { configManager, APP_CONFIG } from '../config/app';

type InitFunction = () => Promise<void> | void;

interface ServiceDefinition { name: string; init: InitFunction; priority: number; required?: boolean; }

class Bootstrap {
  private services: ServiceDefinition[] = [];
  private initialized = false;
  private startTime = 0;

  /** 注册服务 */
  register(name: string, init: InitFunction, priority = 50, required = false): void {
    this.services.push({ name, init, priority, required });
  }

  /** 启动所有服务 */
  async start(): Promise<{ success: boolean; duration: number; errors: string[] }> {
    if (this.initialized) return { success: true, duration: 0, errors: [] };
    this.startTime = performance.now();
    const errors: string[] = [];

    // 按优先级排序（数字越小优先级越高）
    this.services.sort((a, b) => a.priority - b.priority);

    console.log('[Bootstrap] 开始初始化应用...');
    performance.mark('app-init-start');

    for (const service of this.services) {
      try {
        console.log(`[Bootstrap] 初始化 ${service.name}...`);
        const start = performance.now();
        await service.init();
        console.log(`[Bootstrap] ${service.name} 完成 (${(performance.now() - start).toFixed(0)}ms)`);
      } catch (e) {
        const error = `${service.name}: ${(e as Error).message}`;
        errors.push(error);
        console.error(`[Bootstrap] ${service.name} 失败:`, e);
        if (service.required) {
          console.error('[Bootstrap] 必要服务失败，停止启动');
          return { success: false, duration: performance.now() - this.startTime, errors };
        }
      }
    }

    this.initialized = true;
    performance.mark('app-init-end');
    performance.measure('app-init', 'app-init-start', 'app-init-end');

    const duration = performance.now() - this.startTime;
    console.log(`[Bootstrap] 应用初始化完成 (${duration.toFixed(0)}ms)`);

    return { success: errors.length === 0, duration, errors };
  }

  isInitialized(): boolean { return this.initialized; }
}

export const bootstrap = new Bootstrap();

// ============ 默认服务注册 ============

export function registerDefaultServices(): void {
  // 优先级 10: 核心配置
  bootstrap.register('Config', () => {
    console.log('[Config] 加载配置:', configManager.getAll().name);
  }, 10, true);

  // 优先级 20: 主题
  bootstrap.register('Theme', () => {
    const theme = localStorage.getItem(APP_CONFIG.storageKeys.theme) || APP_CONFIG.theme.default;
    document.documentElement.setAttribute('data-theme', theme.includes('light') ? 'light' : 'dark');
  }, 20);

  // 优先级 30: 错误处理
  bootstrap.register('ErrorHandler', () => {
    window.onerror = (msg, url, line, col, error) => { console.error('[GlobalError]', msg, { url, line, col, error }); return false; };
    window.onunhandledrejection = (e) => { console.error('[UnhandledRejection]', e.reason); };
  }, 30, true);

  // 优先级 40: 性能监控
  bootstrap.register('Performance', () => {
    if (typeof PerformanceObserver !== 'undefined') {
      new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          if (entry.duration > 100) console.warn('[PerfWarning]', entry.name, `${entry.duration.toFixed(0)}ms`);
        });
      }).observe({ entryTypes: ['measure'] });
    }
  }, 40);

  // 优先级 50: 快捷键
  bootstrap.register('Shortcuts', () => {
    console.log('[Shortcuts] 注册默认快捷键');
  }, 50);

  // 优先级 60: 会话恢复
  bootstrap.register('Session', () => {
    const session = localStorage.getItem(APP_CONFIG.storageKeys.session);
    if (session) console.log('[Session] 恢复会话数据');
  }, 60);

  // 优先级 90: 分析
  bootstrap.register('Analytics', () => {
    console.log('[Analytics] 启动完成');
  }, 90);
}

// ============ 应用入口 ============

export async function initializeApp(): Promise<void> {
  registerDefaultServices();
  const result = await bootstrap.start();
  
  if (!result.success) {
    console.error('[App] 初始化失败:', result.errors);
    // 显示错误界面
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#1e1e1e;color:#fff;font-family:sans-serif;">
        <h1 style="color:#f44336;">应用启动失败</h1>
        <pre style="background:#333;padding:20px;border-radius:8px;max-width:600px;overflow:auto;">${result.errors.join('\n')}</pre>
        <button onclick="location.reload()" style="margin-top:20px;padding:10px 20px;cursor:pointer;">重试</button>
      </div>
    `;
    return;
  }

  console.log(`[App] MindCode v${APP_CONFIG.version} 启动成功 (${result.duration.toFixed(0)}ms)`);
}

export default bootstrap;
