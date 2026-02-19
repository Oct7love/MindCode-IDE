/**
 * 文件日志 Transport
 * NDJSON 格式 + 自动轮转（仅主进程使用）
 */

import * as fs from "fs";
import * as path from "path";
import type { LogEntry, LogTransport } from "./index";

interface FileTransportOptions {
  /** 日志目录 */
  dir: string;
  /** 单个文件最大字节数（默认 5MB） */
  maxSize?: number;
  /** 最大文件数（默认 5） */
  maxFiles?: number;
  /** 文件名前缀（默认 mindcode） */
  prefix?: string;
}

export class FileTransport implements LogTransport {
  private dir: string;
  private maxSize: number;
  private maxFiles: number;
  private prefix: string;
  private stream: fs.WriteStream | null = null;
  private currentSize = 0;
  private writeBuffer: string[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;

  constructor(options: FileTransportOptions) {
    this.dir = options.dir;
    this.maxSize = options.maxSize ?? 5 * 1024 * 1024;
    this.maxFiles = options.maxFiles ?? 5;
    this.prefix = options.prefix ?? "mindcode";
    this.ensureDir();
    this.openStream();
  }

  write(entry: LogEntry): void {
    if (this.closed) return;
    const line = JSON.stringify(entry) + "\n";
    this.writeBuffer.push(line);
    this.currentSize += Buffer.byteLength(line, "utf-8");

    // 500ms 批量刷写，减少 I/O
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => this.flushSync(), 500);
    }

    // 超过大小限制立即轮转
    if (this.currentSize >= this.maxSize) {
      this.flushSync();
      this.rotate();
    }
  }

  async flush(): Promise<void> {
    this.flushSync();
  }

  close(): void {
    this.closed = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushSync();
    this.stream?.end();
    this.stream = null;
  }

  /** 获取当前日志文件路径 */
  getLogPath(): string {
    return path.join(this.dir, `${this.prefix}.log`);
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private openStream(): void {
    const logPath = this.getLogPath();
    // 获取已有文件大小
    if (fs.existsSync(logPath)) {
      const stat = fs.statSync(logPath);
      this.currentSize = stat.size;
    } else {
      this.currentSize = 0;
    }
    this.stream = fs.createWriteStream(logPath, { flags: "a", encoding: "utf-8" });
  }

  private flushSync(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.writeBuffer.length === 0 || !this.stream) return;
    const data = this.writeBuffer.join("");
    this.writeBuffer = [];
    this.stream.write(data);
  }

  private rotate(): void {
    this.stream?.end();
    this.stream = null;

    const logPath = this.getLogPath();

    // 删除最老的文件
    const oldest = path.join(this.dir, `${this.prefix}.${this.maxFiles}.log`);
    if (fs.existsSync(oldest)) fs.unlinkSync(oldest);

    // 依次重命名 N-1 → N
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const from = path.join(this.dir, `${this.prefix}.${i}.log`);
      const to = path.join(this.dir, `${this.prefix}.${i + 1}.log`);
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }

    // 当前文件 → .1.log
    if (fs.existsSync(logPath)) {
      fs.renameSync(logPath, path.join(this.dir, `${this.prefix}.1.log`));
    }

    this.currentSize = 0;
    this.openStream();
  }
}
