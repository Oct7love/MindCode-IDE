import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  errorHandler,
  AppException,
  NetworkError,
  ValidationError,
  AuthError,
} from "@services/errorHandler";

beforeEach(() => {
  errorHandler.clear();
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("errorHandler", () => {
  describe("capture", () => {
    it("捕获 Error 对象", () => {
      const err = new Error("测试错误");
      const appErr = errorHandler.capture(err);

      expect(appErr.code).toBe("Error");
      expect(appErr.message).toBe("测试错误");
      expect(appErr.stack).toBeDefined();
      expect(appErr.timestamp).toBeGreaterThan(0);
    });

    it("捕获字符串", () => {
      const appErr = errorHandler.capture("字符串错误");

      expect(appErr.code).toBe("Error");
      expect(appErr.message).toBe("字符串错误");
      expect(appErr.stack).toBeUndefined();
    });

    it("携带 context 信息", () => {
      const appErr = errorHandler.capture(new Error("err"), { module: "test" });
      expect(appErr.context).toEqual({ module: "test" });
    });
  });

  describe("subscribe", () => {
    it("捕获错误时通知订阅者", () => {
      const listener = vi.fn();
      errorHandler.subscribe(listener);

      errorHandler.capture(new Error("通知"));
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener.mock.calls[0][0].message).toBe("通知");
    });

    it("取消订阅后不再通知", () => {
      const listener = vi.fn();
      const unsub = errorHandler.subscribe(listener);

      unsub();
      errorHandler.capture(new Error("不通知"));
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("wrap", () => {
    it("捕获同步函数错误但仍抛出", () => {
      const fn = () => {
        throw new Error("同步错误");
      };
      const wrapped = errorHandler.wrap(fn);

      expect(() => wrapped()).toThrow("同步错误");
      expect(errorHandler.getLastError()?.message).toBe("同步错误");
    });

    it("同步函数正常返回值", () => {
      const fn = (a: number, b: number) => a + b;
      const wrapped = errorHandler.wrap(fn);
      expect(wrapped(1, 2)).toBe(3);
    });
  });

  describe("wrapAsync", () => {
    it("捕获异步函数错误", async () => {
      const fn = async () => {
        throw new Error("异步错误");
      };

      await expect(errorHandler.wrapAsync(fn)).rejects.toThrow("异步错误");
      expect(errorHandler.getLastError()?.message).toBe("异步错误");
    });

    it("异步函数正常返回值", async () => {
      const fn = async () => 42;
      const result = await errorHandler.wrapAsync(fn);
      expect(result).toBe(42);
    });
  });

  describe("boundary", () => {
    it("捕获错误返回 fallback", () => {
      const result = errorHandler.boundary(() => {
        throw new Error("边界错误");
      }, "默认值");

      expect(result).toBe("默认值");
      expect(errorHandler.getLastError()?.message).toBe("边界错误");
    });

    it("正常时返回原值", () => {
      const result = errorHandler.boundary(() => "成功", "默认值");
      expect(result).toBe("成功");
    });
  });

  describe("getErrors", () => {
    it("since 参数过滤时间", () => {
      errorHandler.capture(new Error("旧错误"));
      const now = Date.now();
      errorHandler.capture(new Error("新错误"));

      const recent = errorHandler.getErrors(now);
      expect(recent.length).toBeGreaterThanOrEqual(1);
      expect(recent.every((e) => e.timestamp >= now)).toBe(true);
    });

    it("无参数返回全部错误", () => {
      errorHandler.capture(new Error("e1"));
      errorHandler.capture(new Error("e2"));
      expect(errorHandler.getErrors()).toHaveLength(2);
    });
  });

  describe("clear", () => {
    it("清空所有错误", () => {
      errorHandler.capture(new Error("e"));
      errorHandler.clear();
      expect(errorHandler.getErrors()).toHaveLength(0);
      expect(errorHandler.getLastError()).toBeUndefined();
    });
  });

  describe("超过 maxErrors 自动裁剪", () => {
    it("超过 100 条时保留最新的 100 条", () => {
      for (let i = 0; i < 105; i++) {
        errorHandler.capture(new Error(`err-${i}`));
      }
      const all = errorHandler.getErrors();
      expect(all.length).toBe(100);
      // 最旧的被裁剪，最新的保留
      expect(all[all.length - 1].message).toBe("err-104");
      expect(all[0].message).toBe("err-5");
    });
  });

  describe("自定义错误类", () => {
    it("AppException 携带 code", () => {
      const err = new AppException("CUSTOM", "自定义错误", { key: "val" });
      expect(err.code).toBe("CUSTOM");
      expect(err.name).toBe("AppException");
      expect(err.context).toEqual({ key: "val" });
      expect(err).toBeInstanceOf(Error);
    });

    it("NetworkError", () => {
      const err = new NetworkError("网络失败");
      expect(err.code).toBe("NETWORK_ERROR");
      expect(err).toBeInstanceOf(AppException);
    });

    it("ValidationError", () => {
      const err = new ValidationError("验证失败");
      expect(err.code).toBe("VALIDATION_ERROR");
    });

    it("AuthError", () => {
      const err = new AuthError("认证失败");
      expect(err.code).toBe("AUTH_ERROR");
    });
  });
});
