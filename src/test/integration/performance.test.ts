/**
 * 性能测试
 */

import { describe, it, expect } from "vitest";
import { RequestPipeline } from "../../core/ai/request-pipeline";
import { CompletionTriggerOptimizer } from "../../renderer/services/bugFixes";

describe("Performance Tests", () => {
  describe("RequestPipeline", () => {
    it("should handle concurrent requests", async () => {
      const pipeline = new RequestPipeline(2);

      const startTime = Date.now();
      const requests = Array.from({ length: 5 }, (_, i) =>
        pipeline.add(() => new Promise((resolve) => setTimeout(() => resolve(i), 100)), i),
      );

      const results = await Promise.all(requests);
      const duration = Date.now() - startTime;

      expect(results).toHaveLength(5);
      expect(results).toEqual([0, 1, 2, 3, 4]);

      // 由于并发数为2,5个请求应该需要约300ms (100ms * 3批次)
      expect(duration).toBeGreaterThan(250);
      expect(duration).toBeLessThan(500);
    });

    it("should respect priority", async () => {
      const pipeline = new RequestPipeline(1);
      const results: number[] = [];

      // 添加不同优先级的请求
      pipeline.add(() => Promise.resolve(results.push(1)), 1);
      pipeline.add(() => Promise.resolve(results.push(2)), 10); // 高优先级
      pipeline.add(() => Promise.resolve(results.push(3)), 5);

      await new Promise((resolve) => setTimeout(resolve, 100));

      // 高优先级应该先执行
      expect(results[0]).toBe(1); // 第一个已经在执行
      expect(results[1]).toBe(2); // 高优先级排在前面
    });

    it("should track statistics", async () => {
      const pipeline = new RequestPipeline(2);

      await pipeline.add(() => Promise.resolve("ok"), 1);
      await pipeline.add(() => Promise.reject(new Error("fail")), 1).catch(() => {});

      const stats = pipeline.getStats();
      expect(stats.totalRequests).toBe(2);
      expect(stats.completedRequests).toBe(1);
      expect(stats.failedRequests).toBe(1);
    });
  });

  describe("CompletionTriggerOptimizer", () => {
    it("should trigger on special chars", () => {
      const optimizer = new CompletionTriggerOptimizer();
      // 每次测试前 reset 清除防抖时间
      expect(optimizer.shouldTrigger("const a", 7, ".")).toBe(true);
      optimizer.reset();
      expect(optimizer.shouldTrigger("func(", 5, "(")).toBe(true);
      optimizer.reset();
      expect(optimizer.shouldTrigger("arr[", 4, "[")).toBe(true);
    });

    it("should not trigger in comments", () => {
      const optimizer = new CompletionTriggerOptimizer();
      expect(optimizer.shouldTrigger("// comment", 10, "t")).toBe(false);
      expect(optimizer.shouldTrigger("# python comment", 16, "t")).toBe(false);
    });

    it("should trigger on space (space is a trigger char)", () => {
      const optimizer = new CompletionTriggerOptimizer();
      // 空格在 triggerChars 中，触发字符检查优先于空行检查
      expect(optimizer.shouldTrigger("   ", 3, " ")).toBe(true);
    });

    it("should trigger after typing 2+ chars", () => {
      const optimizer = new CompletionTriggerOptimizer();
      expect(optimizer.shouldTrigger("const ab", 8, "b")).toBe(true);
      optimizer.reset();
      expect(optimizer.shouldTrigger("const a", 7, "a")).toBe(false);
    });
  });
});
