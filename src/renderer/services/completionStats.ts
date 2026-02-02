/**
 * 补全质量统计服务
 * 追踪补全请求、缓存命中率、接受率等
 */

export interface CompletionStats {
  totalRequests: number; // 总请求数
  cacheHits: number; // 缓存命中
  acceptedCount: number; // 用户接受次数
  rejectedCount: number; // 用户拒绝次数
  avgLatencyMs: number; // 平均延迟
  p95LatencyMs: number; // P95 延迟
  byModel: Record<string, { requests: number; accepted: number; latencySum: number }>; // 按模型统计
}

class CompletionStatsService {
  private stats: CompletionStats = { totalRequests: 0, cacheHits: 0, acceptedCount: 0, rejectedCount: 0, avgLatencyMs: 0, p95LatencyMs: 0, byModel: {} };
  private latencies: number[] = [];
  private maxLatencies = 1000; // 保留最近 1000 次延迟

  /** 记录请求 */
  recordRequest(model: string, latencyMs: number, cached: boolean): void {
    this.stats.totalRequests++;
    if (cached) this.stats.cacheHits++;
    this.latencies.push(latencyMs);
    if (this.latencies.length > this.maxLatencies) this.latencies.shift();
    // 更新模型统计
    if (!this.stats.byModel[model]) this.stats.byModel[model] = { requests: 0, accepted: 0, latencySum: 0 };
    this.stats.byModel[model].requests++;
    this.stats.byModel[model].latencySum += latencyMs;
    this.updateLatencyStats();
  }

  /** 记录接受 */
  recordAccepted(model?: string): void {
    this.stats.acceptedCount++;
    if (model && this.stats.byModel[model]) this.stats.byModel[model].accepted++;
  }

  /** 记录拒绝 */
  recordRejected(): void { this.stats.rejectedCount++; }

  /** 获取统计 */
  getStats(): CompletionStats { return { ...this.stats }; }

  /** 获取缓存命中率 */
  getCacheHitRate(): number { return this.stats.totalRequests > 0 ? this.stats.cacheHits / this.stats.totalRequests : 0; }

  /** 获取接受率 */
  getAcceptanceRate(): number {
    const total = this.stats.acceptedCount + this.stats.rejectedCount;
    return total > 0 ? this.stats.acceptedCount / total : 0;
  }

  /** 重置统计 */
  reset(): void {
    this.stats = { totalRequests: 0, cacheHits: 0, acceptedCount: 0, rejectedCount: 0, avgLatencyMs: 0, p95LatencyMs: 0, byModel: {} };
    this.latencies = [];
  }

  /** 导出报告 */
  exportReport(): string {
    const lines = [
      '# 补全质量报告',
      `总请求: ${this.stats.totalRequests}`,
      `缓存命中率: ${(this.getCacheHitRate() * 100).toFixed(1)}%`,
      `接受率: ${(this.getAcceptanceRate() * 100).toFixed(1)}%`,
      `平均延迟: ${this.stats.avgLatencyMs.toFixed(0)}ms`,
      `P95 延迟: ${this.stats.p95LatencyMs.toFixed(0)}ms`,
      '',
      '## 按模型统计',
    ];
    for (const [model, data] of Object.entries(this.stats.byModel)) {
      const avgLat = data.requests > 0 ? data.latencySum / data.requests : 0;
      const acceptRate = data.requests > 0 ? (data.accepted / data.requests * 100).toFixed(1) : '0';
      lines.push(`- ${model}: ${data.requests} 次, 接受率 ${acceptRate}%, 平均 ${avgLat.toFixed(0)}ms`);
    }
    return lines.join('\n');
  }

  private updateLatencyStats(): void {
    if (this.latencies.length === 0) return;
    const sum = this.latencies.reduce((a, b) => a + b, 0);
    this.stats.avgLatencyMs = sum / this.latencies.length;
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);
    this.stats.p95LatencyMs = sorted[p95Index] || sorted[sorted.length - 1];
  }
}

export const completionStats = new CompletionStatsService();
export default completionStats;
