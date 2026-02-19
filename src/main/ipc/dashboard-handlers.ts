/**
 * Dashboard IPC Handlers
 *
 * 汇聚系统资源、AI 请求、启动性能、缓存状态等指标，供渲染进程 Dashboard 消费。
 */
import { ipcMain } from "electron";
import * as os from "os";
import { getRequestPipeline } from "../../core/ai/request-pipeline";
import { startupTracker, completionCache } from "../../core/performance";
import type { IPCContext } from "./types";

/** 百分位数计算 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)];
}

export function registerDashboardHandlers(_ctx: IPCContext): void {
  ipcMain.handle("dashboard:stats", () => {
    const pipeline = getRequestPipeline();
    const pipelineStats = pipeline.getStats();
    const latencies = pipeline.getLatencies();
    const sorted = [...latencies].sort((a, b) => a - b);

    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();

    return {
      system: {
        memoryRss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
        osTotalMem: os.totalmem(),
        osFreeMem: os.freemem(),
        uptime: Math.floor(process.uptime()),
        cpuUser: cpu.user,
        cpuSystem: cpu.system,
        platform: process.platform,
        nodeVersion: process.version,
      },
      ai: {
        ...pipelineStats,
        p50Latency: percentile(sorted, 0.5),
        p95Latency: percentile(sorted, 0.95),
        p99Latency: percentile(sorted, 0.99),
        latencyHistory: latencies.slice(-30),
      },
      startup: startupTracker.getReport(),
      cache: completionCache.getStats(),
    };
  });
}
