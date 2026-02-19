/**
 * Renderer 日志工具
 *
 * - 开发模式：控制台 + IPC 转发到主进程
 * - 生产模式：warn/error 转发到主进程（debug/info 静默）
 *
 * 使用方式：
 *   import { logger } from '../utils/logger';
 *   logger.info("消息");
 *
 *   import { createNamedLogger } from '../utils/logger';
 *   const log = createNamedLogger("AIPanel");
 *   log.info("面板初始化");
 */

const isDev = typeof process !== "undefined" ? process.env.NODE_ENV === "development" : false;

type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/** 通过 IPC 发送日志到主进程（写入文件） */
function sendToMain(level: LogLevel, source: string, args: unknown[]): void {
  try {
    if (typeof window !== "undefined" && window.mindcode?.log?.write) {
      window.mindcode.log.write({
        level,
        message: args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "),
        source,
      });
    }
  } catch {
    /* 静默失败 */
  }
}

function createLogger(prefix?: string): Logger {
  const src = prefix ?? "renderer";
  const fmt = prefix ? `[${prefix}]` : "";

  return {
    debug: isDev
      ? (...args: unknown[]) => {
          console.debug(fmt, ...args);
          sendToMain("debug", src, args);
        }
      : () => {},
    info: isDev
      ? (...args: unknown[]) => {
          console.log(fmt, ...args);
          sendToMain("info", src, args);
        }
      : () => {},
    warn: (...args: unknown[]) => {
      console.warn(fmt, ...args);
      sendToMain("warn", src, args);
    },
    error: (...args: unknown[]) => {
      console.error(fmt, ...args);
      sendToMain("error", src, args);
    },
  };
}

/** 默认 logger */
export const logger = createLogger();

/** 创建带命名空间的 logger */
export function createNamedLogger(namespace: string): Logger {
  return createLogger(namespace);
}
