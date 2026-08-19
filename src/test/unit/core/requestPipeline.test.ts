/**
 * AI RequestPipeline 请求管道测试
 * 覆盖并发控制、优先级、统计、延迟追踪、队列清空
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestPipeline, getRequestPipeline } from "../../../core/ai/request-pipeline";

vi.mock("../../../core/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) },
}));

describe("RequestPipeline (AI 管道)", () => {
  let pipeline: RequestPipeline;

  beforeEach(() => {
    pipeline = new RequestPipeline(3);
  });

  describe("add() 基本功能", () => {
    it("执行请求并返回结果", async () => {
      const result = await pipeline.add(() => Promise.resolve("ok"));
      expect(result).toBe("ok");
    });

    it("支持不同返回类型", async () => {
      const num = await pipeline.add(() => Promise.resolve(42));
      expect(num).toBe(42);
      const obj = await pipeline.add(() => Promise.resolve({ a: 1 }));
      expect(obj).toEqual({ a: 1 });
    });

    it("失败请求正确传播错误", async () => {
      await expect(pipeline.add(() => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    });
  });

  describe("并发控制", () => {
    it("不超过 maxConcurrent 并发数", async () => {
      const p = new RequestPipeline(2);
      let concurrent = 0;
      let maxConcurrent = 0;

      const makeRequest = () =>
        p.add(async () => {
          concurrent++;
          maxConcurrent = Math.max(maxConcurrent, concurrent);
          await new Promise((r) => setTimeout(r, 50));
          concurrent--;
          return concurrent;
        });

      await Promise.all([makeRequest(), makeRequest(), makeRequest(), makeRequest()]);
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });

    it("setMaxConcurrent 动态提高后，后续完成可按新上限并发", async () => {
      const p = new RequestPipeline(1);
      let concurrent = 0;
      let maxSeen = 0;
      const started: number[] = [];
      const release: Array<() => void> = [];

      const make = (id: number) =>
        p.add(async () => {
          concurrent++;
          maxSeen = Math.max(maxSeen, concurrent);
          started.push(id);
          await new Promise<void>((resolve) => {
            release[id] = resolve;
          });
          concurrent--;
        });

      const running = [make(0), make(1), make(2)];
      await vi.waitFor(() => expect(started).toEqual([0]));
      expect(maxSeen).toBe(1);

      p.setMaxConcurrent(3);
      release[0]();
      await vi.waitFor(() => expect(started).toHaveLength(3));
      expect(maxSeen).toBeLessThanOrEqual(3);
      expect(maxSeen).toBeGreaterThan(1);

      release[1]();
      release[2]();
      await Promise.all(running);
    });

    it("setMaxConcurrent 最小值为 1", async () => {
      const p = new RequestPipeline(3);
      p.setMaxConcurrent(0);
      p.setMaxConcurrent(-5);

      let concurrent = 0;
      let maxSeen = 0;
      const make = () =>
        p.add(async () => {
          concurrent++;
          maxSeen = Math.max(maxSeen, concurrent);
          await new Promise((r) => setTimeout(r, 30));
          concurrent--;
        });

      await Promise.all([make(), make(), make()]);
      expect(maxSeen).toBe(1);
    });
  });

  describe("优先级调度", () => {
    it("高优先级请求优先执行", async () => {
      const order: number[] = [];
      const p = new RequestPipeline(1);

      // 先用一个阻塞请求占住管道
      let unblock!: () => void;
      const blocker = new Promise<void>((r) => {
        unblock = r;
      });
      p.add(() => blocker);

      // 添加不同优先级的请求（此时都在排队）
      const p1 = p.add(async () => {
        order.push(1);
      }, 1);
      const p2 = p.add(async () => {
        order.push(10);
      }, 10);
      const p3 = p.add(async () => {
        order.push(5);
      }, 5);

      // 释放阻塞
      unblock();
      await Promise.all([p1, p2, p3]);

      // 高优先级（10）应排在前面
      expect(order[0]).toBe(10);
      expect(order[1]).toBe(5);
      expect(order[2]).toBe(1);
    });
  });

  describe("统计信息", () => {
    it("追踪总请求数", async () => {
      await pipeline.add(() => Promise.resolve("a"));
      await pipeline.add(() => Promise.resolve("b"));
      const stats = pipeline.getStats();
      expect(stats.totalRequests).toBe(2);
    });

    it("追踪成功和失败请求数", async () => {
      await pipeline.add(() => Promise.resolve("ok"));
      await pipeline.add(() => Promise.reject(new Error("fail"))).catch(() => {});
      const stats = pipeline.getStats();
      expect(stats.completedRequests).toBe(1);
      expect(stats.failedRequests).toBe(1);
    });

    it("计算平均延迟", async () => {
      await pipeline.add(() => new Promise((r) => setTimeout(() => r("a"), 20)));
      const stats = pipeline.getStats();
      expect(stats.avgLatency).toBeGreaterThan(0);
    });

    it("getStats 返回副本", async () => {
      await pipeline.add(() => Promise.resolve("x"));
      const s1 = pipeline.getStats();
      const s2 = pipeline.getStats();
      expect(s1).toEqual(s2);
      expect(s1).not.toBe(s2);
    });
  });

  describe("延迟历史", () => {
    it("getLatencies 返回延迟数组", async () => {
      await pipeline.add(() => Promise.resolve("fast"));
      const latencies = pipeline.getLatencies();
      expect(Array.isArray(latencies)).toBe(true);
      expect(latencies.length).toBe(1);
      expect(latencies[0]).toBeGreaterThanOrEqual(0);
    });

    it("getLatencies 返回副本", async () => {
      await pipeline.add(() => Promise.resolve("x"));
      const l1 = pipeline.getLatencies();
      const l2 = pipeline.getLatencies();
      expect(l1).not.toBe(l2);
    });

    it("最多保留 100 条延迟记录", async () => {
      const p = new RequestPipeline(100);
      const requests = Array.from({ length: 110 }, () => p.add(() => Promise.resolve("x")));
      await Promise.all(requests);
      expect(p.getLatencies().length).toBeLessThanOrEqual(100);
    });
  });

  describe("clear()", () => {
    it("清空队列并拒绝所有等待中的请求", async () => {
      const p = new RequestPipeline(1);
      let unblock!: () => void;
      const blocker = new Promise<void>((r) => {
        unblock = r;
      });
      p.add(() => blocker);

      const pending = p.add(() => Promise.resolve("should-reject"));
      p.clear();
      unblock();

      await expect(pending).rejects.toThrow("Pipeline cleared");
    });
  });

  describe("getRequestPipeline() 全局单例", () => {
    it("返回 RequestPipeline 实例", () => {
      const p = getRequestPipeline();
      expect(p).toBeInstanceOf(RequestPipeline);
    });

    it("多次调用返回同一实例", () => {
      const p1 = getRequestPipeline();
      const p2 = getRequestPipeline();
      expect(p1).toBe(p2);
    });
  });
});
