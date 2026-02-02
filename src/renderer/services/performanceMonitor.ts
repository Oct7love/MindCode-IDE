/**
 * Performance Monitor - 性能监控服务
 */

interface PerformanceMetric { name: string; value: number; timestamp: number; tags?: Record<string, string>; }
interface PerformanceReport { metrics: PerformanceMetric[]; summary: { avg: number; min: number; max: number; p95: number; count: number }; }

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private marks: Map<string, number> = new Map();
  private observers: ((metric: PerformanceMetric) => void)[] = [];
  private maxMetrics = 1000;

  mark(name: string): void { this.marks.set(name, performance.now()); } // 标记开始

  measure(name: string, startMark?: string, tags?: Record<string, string>): number { // 测量耗时
    const start = startMark ? this.marks.get(startMark) : this.marks.get(name);
    if (!start) return 0;
    const duration = performance.now() - start;
    this.record(name, duration, tags);
    if (startMark) this.marks.delete(startMark);
    else this.marks.delete(name);
    return duration;
  }

  record(name: string, value: number, tags?: Record<string, string>): void { // 记录指标
    const metric: PerformanceMetric = { name, value, timestamp: Date.now(), tags };
    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) this.metrics = this.metrics.slice(-this.maxMetrics);
    this.observers.forEach(fn => fn(metric));
  }

  async time<T>(name: string, fn: () => T | Promise<T>, tags?: Record<string, string>): Promise<T> { // 计时执行
    const start = performance.now();
    try { return await fn(); }
    finally { this.record(name, performance.now() - start, tags); }
  }

  getMetrics(name?: string, since?: number): PerformanceMetric[] { // 获取指标
    let result = this.metrics;
    if (name) result = result.filter(m => m.name === name);
    if (since) result = result.filter(m => m.timestamp >= since);
    return result;
  }

  getReport(name: string, since?: number): PerformanceReport { // 生成报告
    const metrics = this.getMetrics(name, since);
    const values = metrics.map(m => m.value).sort((a, b) => a - b);
    if (values.length === 0) return { metrics: [], summary: { avg: 0, min: 0, max: 0, p95: 0, count: 0 } };
    const sum = values.reduce((a, b) => a + b, 0);
    return {
      metrics,
      summary: {
        avg: sum / values.length,
        min: values[0],
        max: values[values.length - 1],
        p95: values[Math.floor(values.length * 0.95)] || values[values.length - 1],
        count: values.length,
      },
    };
  }

  subscribe(fn: (metric: PerformanceMetric) => void): () => void { // 订阅指标
    this.observers.push(fn);
    return () => { this.observers = this.observers.filter(f => f !== fn); };
  }

  clear(): void { this.metrics = []; this.marks.clear(); } // 清空

  getWebVitals(): Record<string, number> { // Web Vitals
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    const paint = performance.getEntriesByType('paint');
    return {
      ttfb: nav?.responseStart - nav?.requestStart || 0,
      fcp: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
      domReady: nav?.domContentLoadedEventEnd - nav?.fetchStart || 0,
      load: nav?.loadEventEnd - nav?.fetchStart || 0,
      memoryUsed: (performance as any).memory?.usedJSHeapSize / 1048576 || 0,
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// React Hook
import { useEffect, useState } from 'react';
export function usePerformance(name: string, interval = 5000): PerformanceReport {
  const [report, setReport] = useState<PerformanceReport>({ metrics: [], summary: { avg: 0, min: 0, max: 0, p95: 0, count: 0 } });
  useEffect(() => {
    const update = () => setReport(performanceMonitor.getReport(name, Date.now() - interval * 10));
    update();
    const id = setInterval(update, interval);
    return () => clearInterval(id);
  }, [name, interval]);
  return report;
}

export default performanceMonitor;
