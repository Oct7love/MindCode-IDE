/**
 * PerformancePanel - 性能监控面板
 */

import React, { useState, useEffect, useCallback } from 'react';

interface PerfMetric { name: string; value: number; unit: string; status: 'good' | 'warning' | 'bad'; }
interface MemoryInfo { used: number; total: number; limit: number; }

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatMs = (ms: number) => ms < 1000 ? `${ms.toFixed(0)}ms` : `${(ms / 1000).toFixed(2)}s`;

export const PerformancePanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [metrics, setMetrics] = useState<PerfMetric[]>([]);
  const [memory, setMemory] = useState<MemoryInfo | null>(null);
  const [fps, setFps] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const collectMetrics = useCallback(() => {
    setRefreshing(true);
    const collected: PerfMetric[] = [];

    // Web Vitals
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (nav) {
      collected.push({ name: 'DOM Ready', value: nav.domContentLoadedEventEnd - nav.startTime, unit: 'ms', status: nav.domContentLoadedEventEnd - nav.startTime < 1000 ? 'good' : 'warning' });
      collected.push({ name: 'Page Load', value: nav.loadEventEnd - nav.startTime, unit: 'ms', status: nav.loadEventEnd - nav.startTime < 2000 ? 'good' : 'warning' });
      collected.push({ name: 'TTFB', value: nav.responseStart - nav.requestStart, unit: 'ms', status: nav.responseStart - nav.requestStart < 200 ? 'good' : 'warning' });
    }

    // Memory
    const perf = performance as any;
    if (perf.memory) {
      const mem = perf.memory;
      setMemory({ used: mem.usedJSHeapSize, total: mem.totalJSHeapSize, limit: mem.jsHeapSizeLimit });
      const usedPercent = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
      collected.push({ name: 'Memory', value: usedPercent, unit: '%', status: usedPercent < 50 ? 'good' : usedPercent < 80 ? 'warning' : 'bad' });
    }

    // Custom marks
    const marks = performance.getEntriesByType('mark');
    const measures = performance.getEntriesByType('measure');
    measures.slice(-10).forEach(m => {
      collected.push({ name: m.name, value: m.duration, unit: 'ms', status: m.duration < 100 ? 'good' : m.duration < 500 ? 'warning' : 'bad' });
    });

    setMetrics(collected);
    setTimeout(() => setRefreshing(false), 300);
  }, []);

  // FPS 计算
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const countFrame = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) { setFps(Math.round(frameCount * 1000 / (now - lastTime))); frameCount = 0; lastTime = now; }
      animId = requestAnimationFrame(countFrame);
    };
    animId = requestAnimationFrame(countFrame);
    return () => cancelAnimationFrame(animId);
  }, []);

  useEffect(() => { collectMetrics(); const id = setInterval(collectMetrics, 5000); return () => clearInterval(id); }, [collectMetrics]);

  const getStatusColor = (status: PerfMetric['status']) => status === 'good' ? 'var(--color-success)' : status === 'warning' ? 'var(--color-warning)' : 'var(--color-error)';

  return (
    <div className="w-80 h-full bg-[var(--color-bg-elevated)] border-l border-[var(--color-border)] flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-[var(--color-border)]">
        <span className="font-medium">性能监控</span>
        <div className="flex items-center gap-2">
          <button onClick={collectMetrics} className={`text-xs px-2 py-1 rounded bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-active)] ${refreshing ? 'animate-pulse' : ''}`}>刷新</button>
          {onClose && <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">✕</button>}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-3 space-y-4">
        {/* FPS */}
        <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">FPS</span>
            <span className="text-2xl font-bold" style={{ color: fps >= 50 ? 'var(--color-success)' : fps >= 30 ? 'var(--color-warning)' : 'var(--color-error)' }}>{fps}</span>
          </div>
          <div className="h-1 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
            <div className="h-full transition-all duration-300" style={{ width: `${Math.min(fps / 60 * 100, 100)}%`, backgroundColor: fps >= 50 ? 'var(--color-success)' : fps >= 30 ? 'var(--color-warning)' : 'var(--color-error)' }} />
          </div>
        </div>

        {/* Memory */}
        {memory && (
          <div className="p-3 bg-[var(--color-bg-secondary)] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">内存使用</span>
              <span className="text-sm">{formatBytes(memory.used)} / {formatBytes(memory.limit)}</span>
            </div>
            <div className="h-2 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
              <div className="h-full bg-[var(--color-accent-primary)] transition-all duration-300" style={{ width: `${(memory.used / memory.limit) * 100}%` }} />
            </div>
          </div>
        )}

        {/* Metrics */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-[var(--color-text-muted)]">性能指标</div>
          {metrics.map((m, i) => (
            <div key={i} className="flex items-center justify-between p-2 bg-[var(--color-bg-secondary)] rounded">
              <span className="text-sm">{m.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono">{m.unit === 'ms' ? formatMs(m.value) : m.unit === '%' ? `${m.value.toFixed(1)}%` : m.value}</span>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getStatusColor(m.status) }} />
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button onClick={() => performance.clearMarks()} className="w-full text-xs px-3 py-2 bg-[var(--color-bg-hover)] rounded hover:bg-[var(--color-bg-active)]">清除 Performance Marks</button>
          <button onClick={() => { if ((window as any).gc) (window as any).gc(); }} className="w-full text-xs px-3 py-2 bg-[var(--color-bg-hover)] rounded hover:bg-[var(--color-bg-active)]">触发 GC (需启用)</button>
        </div>
      </div>
    </div>
  );
};

// ============ 性能 Hook ============
export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = useState({ fps: 0, memory: 0 });

  useEffect(() => {
    let frameCount = 0, lastTime = performance.now(), animId: number;
    const update = () => {
      frameCount++;
      const now = performance.now();
      if (now - lastTime >= 1000) {
        const perf = performance as any;
        setMetrics({ fps: Math.round(frameCount * 1000 / (now - lastTime)), memory: perf.memory ? Math.round(perf.memory.usedJSHeapSize / 1024 / 1024) : 0 });
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, []);

  return metrics;
};

export default PerformancePanel;
