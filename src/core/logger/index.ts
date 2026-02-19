/**
 * 结构化日志系统
 * 分级日志 + Transport 抽象 + traceId + 文件输出
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  source?: string;
  traceId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

/** 日志输出目标抽象 */
export interface LogTransport {
  write(entry: LogEntry): void;
  flush?(): Promise<void>;
  close?(): void;
}

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

/** 控制台输出 Transport */
class ConsoleTransport implements LogTransport {
  constructor(private enabled: boolean = true) {}

  write(entry: LogEntry): void {
    if (!this.enabled) return;
    const prefix = `[${new Date(entry.timestamp).toISOString()}] [${entry.level.toUpperCase()}]${entry.source ? ` [${entry.source}]` : ""}${entry.traceId ? ` [${entry.traceId}]` : ""}`;
    const method =
      entry.level === "error"
        ? console.error
        : entry.level === "warn"
          ? console.warn
          : entry.level === "debug"
            ? console.debug
            : console.log;
    if (entry.data !== undefined) method(prefix, entry.message, entry.data);
    else method(prefix, entry.message);
  }
}

class Logger {
  private minLevel: LogLevel = "info";
  private buffer: LogEntry[] = [];
  private maxBuffer = 1000;
  private transports: LogTransport[] = [];
  private listeners = new Set<(entry: LogEntry) => void>();
  private errorHandlers = new Set<(entry: LogEntry) => void>();
  private _traceId: string | undefined;

  constructor() {
    // 默认添加控制台输出
    this.transports.push(new ConsoleTransport());
  }

  /** 设置最小日志级别 */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
  }

  /** 添加输出目标 */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /** 移除所有指定类型的 Transport */
  removeTransport(transport: LogTransport): void {
    const idx = this.transports.indexOf(transport);
    if (idx !== -1) this.transports.splice(idx, 1);
  }

  /** 设置当前 traceId（贯穿请求链路） */
  setTraceId(id: string | undefined): void {
    this._traceId = id;
  }

  /** 获取当前 traceId */
  getTraceId(): string | undefined {
    return this._traceId;
  }

  /** 生成唯一 traceId */
  static generateTraceId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  debug(message: string, data?: unknown, source?: string): void {
    this._write("debug", message, data, source);
  }

  info(message: string, data?: unknown, source?: string): void {
    this._write("info", message, data, source);
  }

  warn(message: string, data?: unknown, source?: string): void {
    this._write("warn", message, data, source);
  }

  error(message: string, data?: unknown, source?: string): void {
    this._write("error", message, data, source);
  }

  /** 通用写入方法 */
  private _write(level: LogLevel, message: string, data?: unknown, source?: string): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.minLevel]) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: Date.now(),
      source,
      traceId: this._traceId,
      data,
    };

    // 写入所有 Transport
    for (const t of this.transports) {
      try {
        t.write(entry);
      } catch {
        /* Transport 写入失败不应阻塞业务 */
      }
    }

    // 缓冲区
    this.buffer.push(entry);
    if (this.buffer.length > this.maxBuffer) this.buffer.shift();

    // 通知监听器
    this.listeners.forEach((l) => l(entry));
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

  /** 导出日志为文本 */
  export(): string {
    return this.buffer
      .map((e) => {
        const time = new Date(e.timestamp).toISOString();
        const data = e.data ? ` ${JSON.stringify(e.data)}` : "";
        const trace = e.traceId ? ` [${e.traceId}]` : "";
        return `${time} [${e.level.toUpperCase()}]${e.source ? ` [${e.source}]` : ""}${trace} ${e.message}${data}`;
      })
      .join("\n");
  }

  /** 导出日志为 NDJSON */
  exportJSON(): string {
    return this.buffer.map((e) => JSON.stringify(e)).join("\n");
  }

  /** 清空日志 */
  clear(): void {
    this.buffer = [];
  }

  /** 刷新所有 Transport */
  async flush(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.flush?.()));
  }

  /** 关闭所有 Transport */
  close(): void {
    this.transports.forEach((t) => t.close?.());
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
  debug(message: string, data?: unknown): void {
    this.parent.debug(message, data, this.source);
  }
  info(message: string, data?: unknown): void {
    this.parent.info(message, data, this.source);
  }
  warn(message: string, data?: unknown): void {
    this.parent.warn(message, data, this.source);
  }
  error(message: string, data?: unknown): void {
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
