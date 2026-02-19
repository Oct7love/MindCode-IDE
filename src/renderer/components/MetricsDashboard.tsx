/**
 * MetricsDashboard - 性能监控仪表盘
 *
 * 实时展示系统资源、AI 请求、启动性能、缓存状态。
 * 纯 CSS 实现，无外部图表依赖。
 */
import React, { useState, useEffect, useCallback, useRef } from "react";

// ============ 类型 ============

interface DashboardStats {
  system: {
    memoryRss: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
    osTotalMem: number;
    osFreeMem: number;
    uptime: number;
    cpuUser: number;
    cpuSystem: number;
    platform: string;
    nodeVersion: string;
  };
  ai: {
    totalRequests: number;
    completedRequests: number;
    failedRequests: number;
    avgLatency: number;
    queueLength: number;
    p50Latency: number;
    p95Latency: number;
    p99Latency: number;
    latencyHistory: number[];
  };
  startup: {
    marks: Record<string, number>;
    measures: Record<string, number>;
    totalMs: number;
  };
  cache: {
    size: number;
    hotPatterns: number;
  };
}

// ============ 工具函数 ============

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${(bytes / 1073741824).toFixed(2)} GB`;
}

function formatMs(ms: number): string {
  if (ms === 0) return "0ms";
  if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

type StatusLevel = "good" | "warn" | "bad";

function getStatus(value: number, warnAt: number, badAt: number): StatusLevel {
  if (value >= badAt) return "bad";
  if (value >= warnAt) return "warn";
  return "good";
}

const STATUS_COLORS: Record<StatusLevel, string> = {
  good: "var(--color-success, #4ade80)",
  warn: "var(--color-warning, #facc15)",
  bad: "var(--color-error, #f87171)",
};

// ============ 子组件 ============

/** 迷你进度条 */
const MiniBar: React.FC<{
  value: number;
  max: number;
  color?: string;
  label?: string;
}> = ({ value, max, color, label }) => {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const status = getStatus(pct, 60, 85);
  const barColor = color || STATUS_COLORS[status];
  return (
    <div className="flex items-center gap-2 text-xs">
      {label && <span className="text-[var(--color-text-muted)] w-16 shrink-0">{label}</span>}
      <div className="flex-1 h-1.5 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>
      <span className="font-mono w-12 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
};

/** 迷你火花线（延迟历史可视化） */
const Sparkline: React.FC<{ data: number[]; width?: number; height?: number }> = ({
  data,
  width = 120,
  height = 24,
}) => {
  if (data.length < 2) return <div style={{ width, height }} />;
  const max = Math.max(...data, 1);
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - (v / max) * (height - 2) - 1}`)
    .join(" ");
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-accent-primary, #60a5fa)"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/** 指标卡片 */
const MetricCard: React.FC<{
  title: string;
  value: string;
  subtitle?: string;
  status?: StatusLevel;
}> = ({ title, value, subtitle, status }) => (
  <div className="flex flex-col gap-0.5 p-2 bg-[var(--color-bg-secondary)] rounded">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
        {title}
      </span>
      {status && (
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: STATUS_COLORS[status] }}
        />
      )}
    </div>
    <span className="text-sm font-mono font-semibold">{value}</span>
    {subtitle && <span className="text-[10px] text-[var(--color-text-muted)]">{subtitle}</span>}
  </div>
);

// ============ 主组件 ============

const REFRESH_INTERVAL = 3000;

export const MetricsDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [rendererFps, setRendererFps] = useState(0);
  const [rendererMemory, setRendererMemory] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"overview" | "ai" | "startup">("overview");
  const frameRef = useRef({ count: 0, lastTime: performance.now() });

  // FPS 计算
  useEffect(() => {
    let animId: number;
    const tick = () => {
      frameRef.current.count++;
      const now = performance.now();
      if (now - frameRef.current.lastTime >= 1000) {
        setRendererFps(
          Math.round((frameRef.current.count * 1000) / (now - frameRef.current.lastTime)),
        );
        frameRef.current.count = 0;
        frameRef.current.lastTime = now;
      }
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // 渲染进程内存
  useEffect(() => {
    const update = () => {
      const perf = performance as unknown as { memory?: { usedJSHeapSize: number } };
      if (perf.memory) setRendererMemory(perf.memory.usedJSHeapSize);
    };
    update();
    const id = setInterval(update, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, []);

  // 从主进程获取统计数据
  const fetchStats = useCallback(async () => {
    try {
      const data = await window.mindcode?.dashboard?.getStats();
      if (data) {
        setStats(data);
        setError(null);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchStats]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
        Dashboard 加载失败: {error}
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
        加载中...
      </div>
    );
  }

  const { system, ai, startup, cache } = stats;
  const heapPct = system.heapTotal > 0 ? (system.heapUsed / system.heapTotal) * 100 : 0;
  const osMemPct =
    system.osTotalMem > 0 ? ((system.osTotalMem - system.osFreeMem) / system.osTotalMem) * 100 : 0;
  const successRate = ai.totalRequests > 0 ? (ai.completedRequests / ai.totalRequests) * 100 : 100;

  return (
    <div className="flex flex-col h-full overflow-hidden text-[var(--color-text-primary)]">
      {/* 标签栏 */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] shrink-0">
        {(["overview", "ai", "startup"] as const).map((sec) => (
          <button
            key={sec}
            onClick={() => setActiveSection(sec)}
            className={`text-xs px-2.5 py-1 rounded transition-colors ${
              activeSection === sec
                ? "bg-[var(--color-accent-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-hover)]"
            }`}
          >
            {sec === "overview" ? "概览" : sec === "ai" ? "AI 请求" : "启动性能"}
          </button>
        ))}
        <div className="flex-1" />
        <button
          onClick={fetchStats}
          className="text-[10px] px-2 py-0.5 rounded bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-active)] text-[var(--color-text-muted)]"
        >
          刷新
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto p-3">
        {activeSection === "overview" && (
          <div className="grid grid-cols-4 gap-3">
            {/* 系统资源 */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                系统资源
              </div>
              <MetricCard
                title="Renderer FPS"
                value={`${rendererFps}`}
                status={getStatus(60 - rendererFps, 10, 30)}
              />
              <MetricCard
                title="进程内存 (RSS)"
                value={formatBytes(system.memoryRss)}
                subtitle={`Heap: ${formatBytes(system.heapUsed)} / ${formatBytes(system.heapTotal)}`}
                status={getStatus(heapPct, 60, 85)}
              />
              <MetricCard title="渲染进程内存" value={formatBytes(rendererMemory)} />
              <MetricCard
                title="运行时间"
                value={formatUptime(system.uptime)}
                subtitle={`${system.platform} | ${system.nodeVersion}`}
              />
              <div className="space-y-1.5 pt-1">
                <MiniBar value={heapPct} max={100} label="Heap" />
                <MiniBar value={osMemPct} max={100} label="OS Mem" />
              </div>
            </div>

            {/* AI 请求概览 */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                AI 请求
              </div>
              <MetricCard
                title="总请求"
                value={`${ai.totalRequests}`}
                subtitle={`成功 ${ai.completedRequests} / 失败 ${ai.failedRequests}`}
                status={getStatus(100 - successRate, 10, 30)}
              />
              <MetricCard
                title="平均延迟"
                value={formatMs(ai.avgLatency)}
                status={getStatus(ai.avgLatency, 3000, 10000)}
              />
              <MetricCard
                title="P95 延迟"
                value={formatMs(ai.p95Latency)}
                status={getStatus(ai.p95Latency, 5000, 15000)}
              />
              <MetricCard title="队列深度" value={`${ai.queueLength}`} />
              {ai.latencyHistory.length > 1 && (
                <div className="p-2 bg-[var(--color-bg-secondary)] rounded">
                  <div className="text-[10px] text-[var(--color-text-muted)] mb-1">延迟趋势</div>
                  <Sparkline data={ai.latencyHistory} width={200} height={28} />
                </div>
              )}
            </div>

            {/* 缓存 */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                补全缓存
              </div>
              <MetricCard
                title="缓存条目"
                value={`${cache.size}`}
                subtitle={`热点模式: ${cache.hotPatterns}`}
              />
              <MetricCard
                title="成功率"
                value={`${successRate.toFixed(1)}%`}
                status={getStatus(100 - successRate, 5, 20)}
              />
            </div>

            {/* 启动性能概要 */}
            <div className="space-y-2">
              <div className="text-[10px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">
                启动性能
              </div>
              <MetricCard
                title="总启动耗时"
                value={formatMs(startup.totalMs)}
                status={getStatus(startup.totalMs, 3000, 8000)}
              />
              {Object.entries(startup.measures)
                .slice(0, 4)
                .map(([name, ms]) => (
                  <MetricCard
                    key={name}
                    title={name}
                    value={formatMs(ms)}
                    status={getStatus(ms, 1000, 3000)}
                  />
                ))}
            </div>
          </div>
        )}

        {activeSection === "ai" && (
          <div className="space-y-4">
            {/* 延迟分布 */}
            <div>
              <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
                延迟分布
              </div>
              <div className="grid grid-cols-5 gap-2">
                <MetricCard
                  title="最小"
                  value={formatMs(
                    ai.latencyHistory.length > 0 ? Math.min(...ai.latencyHistory) : 0,
                  )}
                />
                <MetricCard title="P50" value={formatMs(ai.p50Latency)} />
                <MetricCard title="平均" value={formatMs(ai.avgLatency)} />
                <MetricCard
                  title="P95"
                  value={formatMs(ai.p95Latency)}
                  status={getStatus(ai.p95Latency, 5000, 15000)}
                />
                <MetricCard
                  title="P99"
                  value={formatMs(ai.p99Latency)}
                  status={getStatus(ai.p99Latency, 10000, 30000)}
                />
              </div>
            </div>

            {/* 请求统计 */}
            <div>
              <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
                请求统计
              </div>
              <div className="grid grid-cols-4 gap-2">
                <MetricCard title="总请求" value={`${ai.totalRequests}`} />
                <MetricCard title="已完成" value={`${ai.completedRequests}`} status="good" />
                <MetricCard
                  title="失败"
                  value={`${ai.failedRequests}`}
                  status={ai.failedRequests > 0 ? "bad" : "good"}
                />
                <MetricCard
                  title="队列"
                  value={`${ai.queueLength}`}
                  status={getStatus(ai.queueLength, 3, 8)}
                />
              </div>
            </div>

            {/* 延迟趋势图 */}
            {ai.latencyHistory.length > 1 && (
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
                  延迟趋势 (最近 {ai.latencyHistory.length} 次请求)
                </div>
                <div className="p-3 bg-[var(--color-bg-secondary)] rounded">
                  <Sparkline data={ai.latencyHistory} width={600} height={48} />
                  <div className="flex justify-between mt-1 text-[10px] text-[var(--color-text-muted)]">
                    <span>旧</span>
                    <span>新</span>
                  </div>
                </div>
              </div>
            )}

            {/* 延迟分布直方图 */}
            {ai.latencyHistory.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
                  延迟分布
                </div>
                <LatencyHistogram data={ai.latencyHistory} />
              </div>
            )}
          </div>
        )}

        {activeSection === "startup" && (
          <div className="space-y-4">
            {/* 启动标记 */}
            <div>
              <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
                启动标记 (相对于进程启动)
              </div>
              <div className="space-y-1">
                {Object.entries(startup.marks)
                  .sort(([, a], [, b]) => a - b)
                  .map(([name, ms]) => (
                    <div
                      key={name}
                      className="flex items-center gap-2 text-xs p-1.5 bg-[var(--color-bg-secondary)] rounded"
                    >
                      <span className="flex-1 font-mono">{name}</span>
                      <span className="font-mono text-[var(--color-text-muted)]">
                        +{formatMs(ms)}
                      </span>
                      <div className="w-32 h-1 bg-[var(--color-bg-tertiary)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min((ms / Math.max(startup.totalMs, 1)) * 100, 100)}%`,
                            backgroundColor: "var(--color-accent-primary)",
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* 启动测量 */}
            {Object.keys(startup.measures).length > 0 && (
              <div>
                <div className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">
                  阶段耗时
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(startup.measures).map(([name, ms]) => (
                    <MetricCard
                      key={name}
                      title={name}
                      value={formatMs(ms)}
                      status={getStatus(ms, 1000, 3000)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 总耗时 */}
            <div className="p-3 bg-[var(--color-bg-secondary)] rounded">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold">总启动耗时</span>
                <span
                  className="text-lg font-mono font-bold"
                  style={{ color: STATUS_COLORS[getStatus(startup.totalMs, 3000, 8000)] }}
                >
                  {formatMs(startup.totalMs)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** 延迟分布直方图 */
const LatencyHistogram: React.FC<{ data: number[] }> = ({ data }) => {
  if (data.length === 0) return null;

  const buckets = [100, 500, 1000, 2000, 5000, 10000, Infinity];
  const labels = ["<100ms", "<500ms", "<1s", "<2s", "<5s", "<10s", "≥10s"];
  const counts = buckets.map(() => 0);

  for (const v of data) {
    for (let i = 0; i < buckets.length; i++) {
      if (v < buckets[i]) {
        counts[i]++;
        break;
      }
    }
  }

  const maxCount = Math.max(...counts, 1);

  return (
    <div className="flex items-end gap-1 h-16 p-2 bg-[var(--color-bg-secondary)] rounded">
      {counts.map((count, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className="w-full flex justify-center">
            {count > 0 && (
              <span className="text-[9px] text-[var(--color-text-muted)]">{count}</span>
            )}
          </div>
          <div
            className="w-full rounded-t transition-all duration-300"
            style={{
              height: `${Math.max((count / maxCount) * 40, count > 0 ? 2 : 0)}px`,
              backgroundColor:
                i <= 1 ? STATUS_COLORS.good : i <= 3 ? STATUS_COLORS.warn : STATUS_COLORS.bad,
              opacity: count > 0 ? 1 : 0.2,
            }}
          />
          <span className="text-[8px] text-[var(--color-text-muted)] whitespace-nowrap">
            {labels[i]}
          </span>
        </div>
      ))}
    </div>
  );
};

export default MetricsDashboard;
