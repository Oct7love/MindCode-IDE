/**
 * Performance 性能模块测试
 * 覆盖 LazyLoader、StartupTracker、RequestPipeline(core)、CompletionCache、PreloadScheduler
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../core/logger", () => ({
  logger: { child: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) },
}));

import {
  LazyLoader,
  StartupTracker,
  RequestPipeline,
  CompletionCache,
  PreloadScheduler,
} from "../../../core/performance";

describe("LazyLoader", () => {
  it("首次调用 get() 执行工厂函数", async () => {
    const factory = vi.fn().mockResolvedValue("instance");
    const loader = new LazyLoader(factory);
    expect(loader.isLoaded()).toBe(false);
    const result = await loader.get();
    expect(result).toBe("instance");
    expect(factory).toHaveBeenCalledTimes(1);
    expect(loader.isLoaded()).toBe(true);
  });

  it("多次调用 get() 仅执行一次工厂函数", async () => {
    const factory = vi.fn().mockResolvedValue("single");
    const loader = new LazyLoader(factory);
    const [r1, r2, r3] = await Promise.all([loader.get(), loader.get(), loader.get()]);
    expect(r1).toBe("single");
    expect(r2).toBe("single");
    expect(r3).toBe("single");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("preload 触发后台加载", async () => {
    const factory = vi.fn().mockResolvedValue("preloaded");
    const loader = new LazyLoader(factory);
    loader.preload();
    await new Promise((r) => setTimeout(r, 50));
    expect(loader.isLoaded()).toBe(true);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("已加载后 preload 不再触发", async () => {
    const factory = vi.fn().mockResolvedValue("done");
    const loader = new LazyLoader(factory);
    await loader.get();
    loader.preload();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe("StartupTracker", () => {
  let tracker: StartupTracker;

  beforeEach(() => {
    tracker = new StartupTracker();
  });

  it("mark 记录时间点", () => {
    tracker.mark("init");
    const report = tracker.getReport();
    expect(report.marks).toHaveProperty("init");
    expect(report.marks.init).toBeTypeOf("number");
  });

  it("measure 计算两个 mark 之间的间隔", async () => {
    tracker.mark("start");
    await new Promise((r) => setTimeout(r, 50));
    tracker.mark("end");
    const duration = tracker.measure("phase1", "start", "end");
    expect(duration).toBeGreaterThanOrEqual(40);
    expect(duration).toBeLessThan(200);
  });

  it("measure 无 end 参数时使用当前时间", async () => {
    tracker.mark("begin");
    await new Promise((r) => setTimeout(r, 30));
    const duration = tracker.measure("elapsed", "begin");
    expect(duration).toBeGreaterThanOrEqual(20);
  });

  it("getReport 返回完整报告", () => {
    tracker.mark("a");
    tracker.mark("b");
    tracker.measure("m1", "a", "b");
    const report = tracker.getReport();
    expect(report.marks).toHaveProperty("a");
    expect(report.marks).toHaveProperty("b");
    expect(report.measures).toHaveProperty("m1");
    expect(report.totalMs).toBeTypeOf("number");
  });

  it("log 不抛异常", () => {
    tracker.mark("x");
    tracker.measure("y", "x");
    expect(() => tracker.log()).not.toThrow();
  });
});

describe("RequestPipeline (core/performance)", () => {
  let pipeline: RequestPipeline;

  beforeEach(() => {
    pipeline = new RequestPipeline(5000);
  });

  it("dedupe 返回请求结果", async () => {
    const result = await pipeline.dedupe("key1", () => Promise.resolve("data"));
    expect(result).toBe("data");
  });

  it("相同 key 的并发请求只执行一次", async () => {
    const fn = vi.fn().mockResolvedValue("shared");
    const [r1, r2] = await Promise.all([pipeline.dedupe("dup", fn), pipeline.dedupe("dup", fn)]);
    expect(r1).toBe("shared");
    expect(r2).toBe("shared");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("缓存在 TTL 内命中", async () => {
    const fn = vi.fn().mockResolvedValue("cached");
    await pipeline.dedupe("c1", fn);
    await pipeline.dedupe("c1", fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("invalidate 清除指定缓存", async () => {
    const fn = vi.fn().mockResolvedValue("v1");
    await pipeline.dedupe("inv", fn);
    pipeline.invalidate("inv");
    fn.mockResolvedValue("v2");
    const result = await pipeline.dedupe("inv", fn);
    expect(result).toBe("v2");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("clear 清空所有缓存", async () => {
    await pipeline.dedupe("a", () => Promise.resolve(1));
    await pipeline.dedupe("b", () => Promise.resolve(2));
    pipeline.clear();
    const fn = vi.fn().mockResolvedValue(3);
    await pipeline.dedupe("a", fn);
    expect(fn).toHaveBeenCalled();
  });

  it("请求失败时不缓存", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("fail"));
    await expect(pipeline.dedupe("err", fn)).rejects.toThrow("fail");
    fn.mockResolvedValue("ok");
    const result = await pipeline.dedupe("err", fn);
    expect(result).toBe("ok");
  });
});

describe("CompletionCache", () => {
  let cache: CompletionCache;

  beforeEach(() => {
    cache = new CompletionCache();
  });

  it("set/get 基本读写", () => {
    cache.set("const ", "result");
    expect(cache.get("const ")).toBe("result");
  });

  it("未命中返回 null", () => {
    expect(cache.get("missing")).toBeNull();
  });

  it("TTL 过期后返回 null", async () => {
    // CompletionCache 的 ttl 为 30s，直接模拟时间
    vi.useFakeTimers();
    cache.set("expire", "val");
    expect(cache.get("expire")).toBe("val");
    vi.advanceTimersByTime(31000);
    expect(cache.get("expire")).toBeNull();
    vi.useRealTimers();
  });

  it("getStats 返回正确统计", () => {
    cache.set("a", "1");
    cache.set("b", "2");
    const stats = cache.getStats();
    expect(stats.size).toBe(2);
    expect(stats.hotPatterns).toBeGreaterThanOrEqual(0);
  });

  it("getHotPatterns 返回热点模式", () => {
    for (let i = 0; i < 5; i++) cache.set(`pattern${i}`, `r${i}`);
    const patterns = cache.getHotPatterns(3);
    expect(patterns.length).toBeLessThanOrEqual(3);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it("get 增加命中计数", () => {
    cache.set("hit", "val");
    cache.get("hit");
    cache.get("hit");
    cache.get("hit");
    // 不抛异常即可，内部 hits 增加
    expect(cache.get("hit")).toBe("val");
  });
});

describe("PreloadScheduler", () => {
  it("schedule 执行任务并标记完成", async () => {
    const scheduler = new PreloadScheduler();
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.schedule("task1", fn, 0);
    await new Promise((r) => setTimeout(r, 100));
    expect(fn).toHaveBeenCalled();
    expect(scheduler.isCompleted("task1")).toBe(true);
  });

  it("已完成的任务不会重复执行", async () => {
    const scheduler = new PreloadScheduler();
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.schedule("once", fn, 0);
    await new Promise((r) => setTimeout(r, 100));
    scheduler.schedule("once", fn, 0);
    await new Promise((r) => setTimeout(r, 50));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("高优先级任务先执行", async () => {
    const scheduler = new PreloadScheduler();
    const order: string[] = [];

    // 先阻塞调度器
    let unblock!: () => void;
    const blocker = new Promise<void>((r) => {
      unblock = r;
    });
    scheduler.schedule("blocker", () => blocker, 10);

    // 添加不同优先级的任务
    scheduler.schedule(
      "low",
      async () => {
        order.push("low");
      },
      1,
    );
    scheduler.schedule(
      "high",
      async () => {
        order.push("high");
      },
      5,
    );

    unblock();
    await new Promise((r) => setTimeout(r, 200));
    // high 优先级更高，应该在 low 之前
    expect(order.indexOf("high")).toBeLessThan(order.indexOf("low"));
  });

  it("任务失败不阻塞后续", async () => {
    const scheduler = new PreloadScheduler();
    scheduler.schedule("fail", () => Promise.reject(new Error("boom")), 5);
    const fn = vi.fn().mockResolvedValue(undefined);
    scheduler.schedule("ok", fn, 1);
    await new Promise((r) => setTimeout(r, 200));
    expect(fn).toHaveBeenCalled();
    expect(scheduler.isCompleted("ok")).toBe(true);
  });
});
