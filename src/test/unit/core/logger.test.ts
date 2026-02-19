/**
 * Logger 结构化日志系统测试
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// mock ConsoleTransport 使用的 console 方法（避免测试输出噪音）
vi.spyOn(console, "log").mockImplementation(() => {});
vi.spyOn(console, "warn").mockImplementation(() => {});
vi.spyOn(console, "error").mockImplementation(() => {});
vi.spyOn(console, "debug").mockImplementation(() => {});

import { logger, log, type LogEntry, type LogTransport } from "../../../core/logger";

describe("Logger 结构化日志系统", () => {
  beforeEach(() => {
    logger.clear();
    logger.setLevel("info");
    logger.setTraceId(undefined);
  });

  describe("基础日志方法", () => {
    it("debug/info/warn/error 均可正常调用", () => {
      logger.setLevel("debug");
      logger.debug("调试信息");
      logger.info("普通信息");
      logger.warn("警告信息");
      logger.error("错误信息");
      const buffer = logger.getBuffer();
      expect(buffer).toHaveLength(4);
      expect(buffer.map((e) => e.level)).toEqual(["debug", "info", "warn", "error"]);
    });

    it("日志条目包含正确的字段", () => {
      logger.info("测试消息", { key: "value" }, "TestSource");
      const [entry] = logger.getBuffer();
      expect(entry.level).toBe("info");
      expect(entry.message).toBe("测试消息");
      expect(entry.data).toEqual({ key: "value" });
      expect(entry.source).toBe("TestSource");
      expect(entry.timestamp).toBeTypeOf("number");
    });

    it("data 参数可选", () => {
      logger.info("无数据");
      const [entry] = logger.getBuffer();
      expect(entry.data).toBeUndefined();
    });
  });

  describe("日志级别过滤", () => {
    it("默认级别为 info，debug 被过滤", () => {
      logger.setLevel("info");
      logger.debug("应该被过滤");
      expect(logger.getBuffer()).toHaveLength(0);
    });

    it("设置为 warn 后 info 被过滤", () => {
      logger.setLevel("warn");
      logger.info("应该被过滤");
      logger.warn("应该保留");
      logger.error("应该保留");
      expect(logger.getBuffer()).toHaveLength(2);
    });

    it("设置为 error 后只有 error 通过", () => {
      logger.setLevel("error");
      logger.debug("过滤");
      logger.info("过滤");
      logger.warn("过滤");
      logger.error("通过");
      expect(logger.getBuffer()).toHaveLength(1);
      expect(logger.getBuffer()[0].level).toBe("error");
    });

    it("设置为 debug 所有级别通过", () => {
      logger.setLevel("debug");
      logger.debug("通过");
      logger.info("通过");
      logger.warn("通过");
      logger.error("通过");
      expect(logger.getBuffer()).toHaveLength(4);
    });
  });

  describe("traceId 链路追踪", () => {
    it("设置和获取 traceId", () => {
      expect(logger.getTraceId()).toBeUndefined();
      logger.setTraceId("trace-001");
      expect(logger.getTraceId()).toBe("trace-001");
    });

    it("日志条目携带当前 traceId", () => {
      logger.setTraceId("trace-002");
      logger.info("带 trace 的日志");
      const [entry] = logger.getBuffer();
      expect(entry.traceId).toBe("trace-002");
    });

    it("清除 traceId 后日志不携带", () => {
      logger.setTraceId("trace-003");
      logger.info("有 trace");
      logger.setTraceId(undefined);
      logger.info("无 trace");
      const buffer = logger.getBuffer();
      expect(buffer[0].traceId).toBe("trace-003");
      expect(buffer[1].traceId).toBeUndefined();
    });
  });

  describe("Transport 管理", () => {
    it("addTransport 添加自定义输出", () => {
      const entries: LogEntry[] = [];
      const transport: LogTransport = { write: (e) => entries.push(e) };
      logger.addTransport(transport);
      logger.info("自定义输出");
      expect(entries).toHaveLength(1);
      expect(entries[0].message).toBe("自定义输出");
      logger.removeTransport(transport);
    });

    it("removeTransport 移除输出", () => {
      const entries: LogEntry[] = [];
      const transport: LogTransport = { write: (e) => entries.push(e) };
      logger.addTransport(transport);
      logger.info("第一条");
      logger.removeTransport(transport);
      logger.info("第二条");
      expect(entries).toHaveLength(1);
    });

    it("Transport 异常不阻塞日志写入", () => {
      const bad: LogTransport = {
        write: () => {
          throw new Error("Transport 崩溃");
        },
      };
      logger.addTransport(bad);
      expect(() => logger.info("不应崩溃")).not.toThrow();
      expect(logger.getBuffer()).toHaveLength(1);
      logger.removeTransport(bad);
    });

    it("flush 调用所有 Transport 的 flush", async () => {
      const flushFn = vi.fn().mockResolvedValue(undefined);
      const transport: LogTransport = { write: vi.fn(), flush: flushFn };
      logger.addTransport(transport);
      await logger.flush();
      expect(flushFn).toHaveBeenCalled();
      logger.removeTransport(transport);
    });

    it("close 调用所有 Transport 的 close", () => {
      const closeFn = vi.fn();
      const transport: LogTransport = { write: vi.fn(), close: closeFn };
      logger.addTransport(transport);
      logger.close();
      expect(closeFn).toHaveBeenCalled();
      logger.removeTransport(transport);
    });
  });

  describe("ChildLogger 子日志", () => {
    it("子日志自动携带 source", () => {
      const child = logger.child("MyModule");
      child.info("子模块日志");
      const buffer = logger.getBuffer();
      const entry = buffer[buffer.length - 1];
      expect(entry.source).toBe("MyModule");
      expect(entry.message).toBe("子模块日志");
    });

    it("子日志的四个级别方法均可用", () => {
      logger.setLevel("debug");
      const child = logger.child("Sub");
      child.debug("d");
      child.info("i");
      child.warn("w");
      child.error("e");
      const buffer = logger.getBuffer();
      const last4 = buffer.slice(-4);
      expect(last4).toHaveLength(4);
      expect(last4.every((e) => e.source === "Sub")).toBe(true);
    });

    it("子日志支持 data 参数", () => {
      const child = logger.child("DataTest");
      child.info("带数据", { foo: 42 });
      const buffer = logger.getBuffer();
      const entry = buffer[buffer.length - 1];
      expect(entry.data).toEqual({ foo: 42 });
    });
  });

  describe("缓冲区管理", () => {
    it("getBuffer 返回全部日志", () => {
      logger.info("a");
      logger.warn("b");
      expect(logger.getBuffer().length).toBeGreaterThanOrEqual(2);
    });

    it("getBuffer 按级别过滤", () => {
      logger.clear();
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
      expect(logger.getBuffer("warn")).toHaveLength(2);
      expect(logger.getBuffer("error")).toHaveLength(1);
    });

    it("clear 清空缓冲区", () => {
      logger.info("a");
      logger.info("b");
      logger.clear();
      expect(logger.getBuffer()).toHaveLength(0);
    });

    it("缓冲区上限为 1000 条", () => {
      logger.clear();
      logger.setLevel("debug");
      for (let i = 0; i < 1050; i++) logger.debug(`log-${i}`);
      const buffer = logger.getBuffer();
      expect(buffer.length).toBe(1000);
      expect(buffer[0].message).toBe("log-50");
    });
  });

  describe("事件监听", () => {
    it("onLog 监听所有日志", () => {
      const listener = vi.fn();
      const unsub = logger.onLog(listener);
      logger.info("触发监听");
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].message).toBe("触发监听");
      unsub();
    });

    it("onLog 取消订阅后不再触发", () => {
      const listener = vi.fn();
      const unsub = logger.onLog(listener);
      unsub();
      logger.info("不应触发");
      expect(listener).not.toHaveBeenCalled();
    });

    it("onError 仅在 error 级别触发", () => {
      const handler = vi.fn();
      const unsub = logger.onError(handler);
      logger.info("不触发");
      logger.warn("不触发");
      logger.error("触发");
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].level).toBe("error");
      unsub();
    });

    it("onError 取消订阅后不再触发", () => {
      const handler = vi.fn();
      const unsub = logger.onError(handler);
      unsub();
      logger.error("不应触发");
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("导出功能", () => {
    it("export 输出可读文本", () => {
      logger.clear();
      logger.info("导出测试", undefined, "Export");
      const text = logger.export();
      expect(text).toContain("[INFO]");
      expect(text).toContain("[Export]");
      expect(text).toContain("导出测试");
    });

    it("export 包含 traceId", () => {
      logger.clear();
      logger.setTraceId("export-trace");
      logger.info("带 trace");
      const text = logger.export();
      expect(text).toContain("[export-trace]");
      logger.setTraceId(undefined);
    });

    it("export 包含 data", () => {
      logger.clear();
      logger.info("带数据", { key: "val" });
      const text = logger.export();
      expect(text).toContain('"key":"val"');
    });

    it("exportJSON 输出 NDJSON 格式", () => {
      logger.clear();
      logger.info("json1");
      logger.warn("json2");
      const json = logger.exportJSON();
      const lines = json.split("\n");
      expect(lines).toHaveLength(2);
      const parsed1 = JSON.parse(lines[0]);
      expect(parsed1.level).toBe("info");
      expect(parsed1.message).toBe("json1");
      const parsed2 = JSON.parse(lines[1]);
      expect(parsed2.level).toBe("warn");
    });
  });

  describe("便捷方法 log.*", () => {
    it("log.info/warn/error/debug 绑定到全局实例", () => {
      logger.clear();
      logger.setLevel("debug");
      log.debug("d");
      log.info("i");
      log.warn("w");
      log.error("e");
      expect(logger.getBuffer()).toHaveLength(4);
    });
  });
});
