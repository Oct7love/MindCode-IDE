/**
 * Logger Utility
 *
 * 统一的日志工具，生产环境自动静默。
 * 使用方式：import { logger } from '../utils/logger';
 *
 * - logger.debug() - 仅开发模式
 * - logger.info()  - 仅开发模式
 * - logger.warn()  - 始终输出
 * - logger.error() - 始终输出
 */

const isDev = typeof process !== "undefined" ? process.env.NODE_ENV === "development" : false;

type LogLevel = "debug" | "info" | "warn" | "error";

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

function createLogger(prefix?: string): Logger {
  const fmt = prefix ? `[${prefix}]` : "";

  return {
    debug: isDev ? (...args: unknown[]) => console.debug(fmt, ...args) : () => {},
    info: isDev ? (...args: unknown[]) => console.log(fmt, ...args) : () => {},
    warn: (...args: unknown[]) => console.warn(fmt, ...args),
    error: (...args: unknown[]) => console.error(fmt, ...args),
  };
}

/** 默认 logger（无前缀） */
export const logger = createLogger();

/** 创建带命名空间的 logger */
export function createNamedLogger(namespace: string): Logger {
  return createLogger(namespace);
}
