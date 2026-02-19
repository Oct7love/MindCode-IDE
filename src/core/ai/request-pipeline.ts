/**
 * AI请求管道
 * 优化并发请求,避免同时发送过多请求
 */

import { logger } from "../logger";

const log = logger.child("Pipeline");

interface PendingRequest<T = unknown> {
  request: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  priority: number;
  timestamp: number;
}

interface PipelineStats {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  avgLatency: number;
  queueLength: number;
}

export class RequestPipeline {
  private queue: PendingRequest[] = [];
  private processing = false;
  private maxConcurrent = 3; // 最大并发数
  private activeRequests = 0;
  private stats: PipelineStats = {
    totalRequests: 0,
    completedRequests: 0,
    failedRequests: 0,
    avgLatency: 0,
    queueLength: 0,
  };
  private latencies: number[] = [];

  constructor(maxConcurrent = 3) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * 添加请求到管道
   * @param request 请求函数
   * @param priority 优先级 (数字越大优先级越高)
   */
  async add<T>(request: () => Promise<T>, priority = 0): Promise<T> {
    this.stats.totalRequests++;
    this.stats.queueLength = this.queue.length;

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        request,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority,
        timestamp: Date.now(),
      });

      // 按优先级排序
      this.queue.sort((a, b) => b.priority - a.priority);

      this.process();
    });
  }

  /**
   * 处理队列
   */
  private async process() {
    // 如果已达到最大并发数,等待
    if (this.activeRequests >= this.maxConcurrent) {
      return;
    }

    // 如果队列为空,停止处理
    if (this.queue.length === 0) {
      return;
    }

    const pending = this.queue.shift()!;
    this.activeRequests++;
    this.stats.queueLength = this.queue.length;

    const startTime = Date.now();

    try {
      const result = await pending.request();
      const latency = Date.now() - startTime;

      // 更新统计
      this.latencies.push(latency);
      if (this.latencies.length > 100) {
        this.latencies.shift(); // 只保留最近100个
      }
      this.stats.avgLatency = this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
      this.stats.completedRequests++;

      pending.resolve(result);
    } catch (error) {
      this.stats.failedRequests++;
      pending.reject(error);
    } finally {
      this.activeRequests--;

      // 继续处理下一个
      this.process();

      // 如果还有更多请求,启动额外的处理器
      if (this.queue.length > 0 && this.activeRequests < this.maxConcurrent) {
        this.process();
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): PipelineStats {
    return { ...this.stats };
  }

  /**
   * 清空队列
   */
  clear() {
    this.queue.forEach((pending) => {
      pending.reject(new Error("Pipeline cleared"));
    });
    this.queue = [];
    this.stats.queueLength = 0;
  }

  /**
   * 设置最大并发数
   */
  setMaxConcurrent(max: number) {
    this.maxConcurrent = Math.max(1, max);
  }
}

// 全局单例
let _pipeline: RequestPipeline | null = null;

export function getRequestPipeline(): RequestPipeline {
  if (!_pipeline) {
    _pipeline = new RequestPipeline(3);
  }
  return _pipeline;
}

/**
 * 预热AI连接
 * 在应用启动时建立连接,减少首次请求延迟
 */
export async function warmupAIConnections() {
  log.info("预热AI连接...");

  // 使用管道发送预热请求
  const pipeline = getRequestPipeline();

  // 低优先级预热请求
  const warmupRequest = () =>
    Promise.race([
      fetch("https://api.anthropic.com/v1/messages", {
        method: "HEAD",
      }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);

  // 添加到管道,低优先级
  pipeline.add(warmupRequest, -1).catch(() => {});

  log.info("AI连接预热完成");
}
