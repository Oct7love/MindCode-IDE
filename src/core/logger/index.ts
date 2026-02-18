/**
 * 日志系统
 * 分级日志 + 文件输出 + 错误上报
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  source?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any; // 日志系统需接受任意类型数据
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

class Logger {
  private minLevel: LogLevel = "info";
  private buffer: LogEntry[] = [];
  private maxBuffer = 1000;
  private listeners = new Set<(entry: LogEntry) => void>();
  private errorHandlers = new Set<(entry: LogEntry) => void>();

  /** 设置最小日志级别 */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** 调试日志 */
  debug(message: string, data?: any, source?: string): void {
    this.log("debug", message, data, source);
  }

  /** 信息日志 */
  info(message: string, data?: any, source?: string): void {
    this.log("info", message, data, source);
  }

  /** 警告日志 */
  warn(message: string, data?: any, source?: string): void {
    this.log("warn", message, data, source);
  }

  /** 错误日志 */
  error(message: string, data?: any, source?: string): void {
    this.log("error", message, data, source);
  }

  /** 通用日志方法 */
  log(level: LogLevel, message: string, data?: any, source?: string): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) return;

    const entry: LogEntry = { level, message, timestamp: Date.now(), source, data };

    // 控制台输出
    const prefix = `[${new Date(entry.timestamp).toISOString()}] [${level.toUpperCase()}]${source ? ` [${source}]` : ""}`;
    const consoleMethod =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : level === "debug"
            ? console.debug
            : console.log;
    if (data !== undefined) consoleMethod(prefix, message, data);
    else consoleMethod(prefix, message);

    // 缓冲区
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();

    // 通知监听器
    this.listeners.forEach((l) => l(entry));

    // 错误处理
    if (level === "error") this.errorHandlers.forEach((h) => h(entry));
  }

  /** 监听日志 */
  onLog(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 监听错误 */
  onError(handler: (entry: LogEntry) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /** 获取日志缓冲区 */
  getBuffer(level?: LogLevel): LogEntry[] {
    if (!level) return [...this.buffer];
    const minLevel = LOG_LEVELS[level];
    return this.buffer.filter((e) => LOG_LEVELS[e.level] >= minLevel);
  }

  /** 导出日志 */
  export(): string {
    return this.buffer
      .map((e) => {
        const time = new Date(e.timestamp).toISOString();
        const data = e.data ? ` ${JSON.stringify(e.data)}` : "";
        return `${time} [${e.level.toUpperCase()}]${e.source ? ` [${e.source}]` : ""} ${e.message}${data}`;
      })
      .join("\n");
  }

  /** 清空日志 */
  clear(): void {
    this.buffer = [];
  }

  /** 创建子 Logger */
  child(source: string): ChildLogger {
    return new ChildLogger(this, source);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private source: string,
  ) {}
  debug(message: string, data?: any): void {
    this.parent.debug(message, data, this.source);
  }
  info(message: string, data?: any): void {
    this.parent.info(message, data, this.source);
  }
  warn(message: string, data?: any): void {
    this.parent.warn(message, data, this.source);
  }
  error(message: string, data?: any): void {
    this.parent.error(message, data, this.source);
  }
}

// 全局实例
export const logger = new Logger();

// 便捷方法
export const log = {
  debug: logger.debug.bind(logger),
  info: logger.info.bind(logger),
  warn: logger.warn.bind(logger),
  error: logger.error.bind(logger),
};

// 全局错误捕获（具名函数 + 去重，防止 HMR 叠加）
function _onGlobalError(e: ErrorEvent) {
  logger.error(`Uncaught: ${e.message}`, { filename: e.filename, lineno: e.lineno }, "global");
}
function _onUnhandledRejection(e: PromiseRejectionEvent) {
  logger.error(`Unhandled Promise: ${e.reason}`, undefined, "global");
}

if (typeof window !== "undefined") {
  window.removeEventListener("error", _onGlobalError as EventListener);
  window.removeEventListener("unhandledrejection", _onUnhandledRejection as EventListener);
  window.addEventListener("error", _onGlobalError as EventListener);
  window.addEventListener("unhandledrejection", _onUnhandledRejection as EventListener);
}
