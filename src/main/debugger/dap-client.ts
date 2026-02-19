/**
 * DAP Client - Debug Adapter Protocol 客户端
 * 通过 stdio 与调试适配器进程通信，使用 Content-Length 消息帧
 */
import type { ChildProcess } from "child_process";
import { spawn as cpSpawn } from "child_process";
import { EventEmitter } from "events";
import { getSupportedLanguages, getAdapter } from "./adapter-registry";
import { logger } from "../../core/logger";

const log = logger.child("DAP");

// ============ DAP 协议类型 ============

export interface DAPRequest {
  seq: number;
  type: "request";
  command: string;
  arguments?: Record<string, unknown>;
}

export interface DAPResponse {
  seq: number;
  type: "response";
  request_seq: number;
  command: string;
  success: boolean;
  message?: string;
  body?: Record<string, unknown>;
}

export interface DAPEvent {
  seq: number;
  type: "event";
  event: string;
  body?: Record<string, unknown>;
}

type DAPMessage = DAPRequest | DAPResponse | DAPEvent;

/** DAP 能力 */
export interface DAPCapabilities {
  supportsConfigurationDoneRequest?: boolean;
  supportsConditionalBreakpoints?: boolean;
  supportsHitConditionalBreakpoints?: boolean;
  supportsEvaluateForHovers?: boolean;
  supportsStepBack?: boolean;
  supportsSetVariable?: boolean;
  supportsRestartFrame?: boolean;
  supportsRestartRequest?: boolean;
}

/** 断点信息 */
export interface DAPBreakpoint {
  id?: number;
  verified: boolean;
  line?: number;
  column?: number;
  message?: string;
  source?: { name?: string; path?: string };
}

/** 栈帧 */
export interface DAPStackFrame {
  id: number;
  name: string;
  source?: { name?: string; path?: string; sourceReference?: number };
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

/** 作用域 */
export interface DAPScope {
  name: string;
  variablesReference: number;
  expensive: boolean;
}

/** 变量 */
export interface DAPVariable {
  name: string;
  value: string;
  type?: string;
  variablesReference: number;
}

// ============ DAP 客户端 ============

export type DAPState = "idle" | "initializing" | "running" | "paused" | "stopped" | "error";

export class DAPClient extends EventEmitter {
  private process: ChildProcess | null = null;
  private seq = 1;
  private pendingRequests = new Map<
    number,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve: (value: any) => void;
      reject: (reason: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  private buffer = Buffer.alloc(0);
  private contentLength = -1;
  private state: DAPState = "idle";
  private capabilities: DAPCapabilities = {};
  private requestTimeout = 30000;

  getState(): DAPState {
    return this.state;
  }
  getCapabilities(): DAPCapabilities {
    return this.capabilities;
  }

  /** 环境变量黑名单（阻止注入攻击） */
  private static readonly DANGEROUS_ENV_KEYS = new Set([
    "LD_PRELOAD",
    "LD_LIBRARY_PATH",
    "DYLD_INSERT_LIBRARIES",
    "DYLD_LIBRARY_PATH",
    "DYLD_FRAMEWORK_PATH",
    "NODE_OPTIONS",
    "ELECTRON_RUN_AS_NODE",
    "ELECTRON_NO_ASAR",
  ]);

  /** 过滤危险环境变量 */
  private static filterEnv(env?: Record<string, string>): Record<string, string> {
    const base: Record<string, string> = {};
    // 仅继承安全的基础环境变量
    const safeBaseKeys = [
      "PATH",
      "HOME",
      "USERPROFILE",
      "LANG",
      "TERM",
      "SystemRoot",
      "COMSPEC",
      "TMPDIR",
      "TEMP",
      "TMP",
    ];
    for (const key of safeBaseKeys) {
      if (process.env[key]) base[key] = process.env[key]!;
    }
    if (!env) return base;
    // 合并用户 env，但过滤危险项
    for (const [key, val] of Object.entries(env)) {
      if (!DAPClient.DANGEROUS_ENV_KEYS.has(key.toUpperCase())) {
        base[key] = val;
      } else {
        log.warn(`已过滤危险环境变量: ${key}`);
      }
    }
    return base;
  }

  /** 启动调试适配器进程（仅允许已注册的适配器命令） */
  async spawn(command: string, args: string[] = [], env?: Record<string, string>): Promise<void> {
    // 验证命令是否来自已注册的适配器
    const languages = getSupportedLanguages();
    const isRegistered = languages.some((lang) => {
      const adapter = getAdapter(lang);
      return adapter && adapter.command === command;
    });
    if (!isRegistered) {
      throw new Error(`不允许的调试适配器命令: ${command}，仅支持已注册的适配器`);
    }

    // 校验 args 不含 Shell 元字符
    for (const arg of args) {
      if (/[;&|`$()<>!{}\n\r]/.test(arg)) {
        throw new Error(`不安全的调试参数: ${arg}`);
      }
    }

    if (this.process) await this.disconnect();

    this.process = cpSpawn(command, args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: DAPClient.filterEnv(env),
      shell: false,
      windowsHide: true,
    });

    this.process.stdout!.on("data", (chunk: Buffer) => this.onData(chunk));
    this.process.stderr!.on("data", (chunk: Buffer) => {
      log.error(`stderr: ${chunk.toString()}`);
    });

    this.process.on("exit", (code, signal) => {
      log.info(`适配器退出: code=${code}, signal=${signal}`);
      this.state = "stopped";
      this.rejectAllPending(new Error(`适配器退出: code=${code}`));
      this.emit("exit", { code, signal });
    });

    this.process.on("error", (err) => {
      log.error("适配器错误", err);
      this.state = "error";
      this.emit("error", err);
    });
  }

  // ============ Content-Length 消息解析 ============

  private onData(chunk: Buffer): void {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.parseMessage()) {
      /* 持续解析 */
    }
  }

  private parseMessage(): boolean {
    if (this.contentLength === -1) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) return false;
      const header = this.buffer.subarray(0, headerEnd).toString("ascii");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.subarray(headerEnd + 4);
        return true;
      }
      this.contentLength = parseInt(match[1], 10);
      this.buffer = this.buffer.subarray(headerEnd + 4);
    }

    if (this.buffer.length < this.contentLength) return false;

    const body = this.buffer.subarray(0, this.contentLength).toString("utf-8");
    this.buffer = this.buffer.subarray(this.contentLength);
    this.contentLength = -1;

    try {
      const msg: DAPMessage = JSON.parse(body);
      this.handleMessage(msg);
    } catch (e) {
      log.error("消息解析失败", e);
    }

    return true;
  }

  // ============ 消息处理 ============

  private handleMessage(msg: DAPMessage): void {
    if (msg.type === "response") {
      const resp = msg as DAPResponse;
      const pending = this.pendingRequests.get(resp.request_seq);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingRequests.delete(resp.request_seq);
        if (resp.success) {
          pending.resolve(resp.body || {});
        } else {
          pending.reject(new Error(resp.message || `DAP 请求失败: ${resp.command}`));
        }
      }
    } else if (msg.type === "event") {
      const evt = msg as DAPEvent;
      this.handleEvent(evt);
    }
  }

  private handleEvent(evt: DAPEvent): void {
    switch (evt.event) {
      case "initialized":
        this.emit("initialized");
        break;
      case "stopped":
        this.state = "paused";
        this.emit("stopped", evt.body);
        break;
      case "continued":
        this.state = "running";
        this.emit("continued", evt.body);
        break;
      case "terminated":
        this.state = "stopped";
        this.emit("terminated", evt.body);
        break;
      case "exited":
        this.state = "stopped";
        this.emit("exited", evt.body);
        break;
      case "thread":
        this.emit("thread", evt.body);
        break;
      case "output":
        this.emit("output", evt.body);
        break;
      case "breakpoint":
        this.emit("breakpoint", evt.body);
        break;
      default:
        this.emit(evt.event, evt.body);
    }
  }

  // ============ 请求发送 ============

  private sendRaw(msg: DAPMessage): void {
    if (!this.process?.stdin?.writable) {
      throw new Error("适配器进程不可用");
    }
    const json = JSON.stringify(msg);
    const header = `Content-Length: ${Buffer.byteLength(json, "utf-8")}\r\n\r\n`;
    this.process.stdin.write(header + json);
  }

  /** 发送 DAP 请求并等待响应 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendRequest(command: string, args?: Record<string, unknown>): Promise<any> {
    return new Promise((resolve, reject) => {
      const seq = this.seq++;
      const timer = setTimeout(() => {
        this.pendingRequests.delete(seq);
        reject(new Error(`DAP 请求超时: ${command} (${this.requestTimeout}ms)`));
      }, this.requestTimeout);

      this.pendingRequests.set(seq, { resolve, reject, timer });

      try {
        this.sendRaw({ seq, type: "request", command, arguments: args } as DAPRequest);
      } catch (e) {
        clearTimeout(timer);
        this.pendingRequests.delete(seq);
        reject(e);
      }
    });
  }

  // ============ DAP 高级命令 ============

  /** 初始化调试会话 */
  async initialize(clientId = "mindcode"): Promise<DAPCapabilities> {
    this.state = "initializing";
    const body = await this.sendRequest("initialize", {
      clientID: clientId,
      clientName: "MindCode IDE",
      adapterID: "mindcode",
      pathFormat: "path",
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsVariablePaging: false,
      supportsRunInTerminalRequest: false,
      locale: "zh-CN",
    });
    this.capabilities = body || {};
    return this.capabilities;
  }

  /** 启动调试目标 */
  async launch(config: Record<string, unknown>): Promise<void> {
    await this.sendRequest("launch", config);
    this.state = "running";
  }

  /** 附加到正在运行的进程 */
  async attach(config: Record<string, unknown>): Promise<void> {
    await this.sendRequest("attach", config);
    this.state = "running";
  }

  /** 配置完成 */
  async configurationDone(): Promise<void> {
    await this.sendRequest("configurationDone");
  }

  /** 设置断点 */
  async setBreakpoints(
    sourcePath: string,
    breakpoints: Array<{
      line: number;
      condition?: string;
      hitCondition?: string;
      logMessage?: string;
    }>,
  ): Promise<DAPBreakpoint[]> {
    const body = await this.sendRequest("setBreakpoints", {
      source: { path: sourcePath },
      breakpoints,
      sourceModified: false,
    });
    return body?.breakpoints || [];
  }

  /** 继续执行 */
  async continue(threadId = 1): Promise<void> {
    await this.sendRequest("continue", { threadId });
    this.state = "running";
  }

  /** 单步跳过 */
  async next(threadId = 1): Promise<void> {
    await this.sendRequest("next", { threadId });
  }

  /** 单步进入 */
  async stepIn(threadId = 1): Promise<void> {
    await this.sendRequest("stepIn", { threadId });
  }

  /** 单步跳出 */
  async stepOut(threadId = 1): Promise<void> {
    await this.sendRequest("stepOut", { threadId });
  }

  /** 暂停执行 */
  async pause(threadId = 1): Promise<void> {
    await this.sendRequest("pause", { threadId });
  }

  /** 获取线程列表 */
  async threads(): Promise<Array<{ id: number; name: string }>> {
    const body = await this.sendRequest("threads");
    return body?.threads || [];
  }

  /** 获取调用栈 */
  async stackTrace(threadId = 1, startFrame = 0, levels = 20): Promise<DAPStackFrame[]> {
    const body = await this.sendRequest("stackTrace", { threadId, startFrame, levels });
    return body?.stackFrames || [];
  }

  /** 获取作用域 */
  async scopes(frameId: number): Promise<DAPScope[]> {
    const body = await this.sendRequest("scopes", { frameId });
    return body?.scopes || [];
  }

  /** 获取变量 */
  async variables(
    variablesReference: number,
    start?: number,
    count?: number,
  ): Promise<DAPVariable[]> {
    const body = await this.sendRequest("variables", { variablesReference, start, count });
    return body?.variables || [];
  }

  /** 求值表达式 */
  async evaluate(
    expression: string,
    frameId?: number,
    context: "watch" | "repl" | "hover" = "repl",
  ): Promise<{ result: string; type?: string; variablesReference: number }> {
    const body = await this.sendRequest("evaluate", { expression, frameId, context });
    return body || { result: "", variablesReference: 0 };
  }

  /** 断开连接 */
  async disconnect(restart = false): Promise<void> {
    try {
      if (this.process && !this.process.killed) {
        await this.sendRequest("disconnect", { restart, terminateDebuggee: true }).catch(() => {});
      }
    } finally {
      this.cleanup();
    }
  }

  /** 清理资源 */
  private cleanup(): void {
    this.rejectAllPending(new Error("客户端已关闭"));
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = null;
    this.buffer = Buffer.alloc(0);
    this.contentLength = -1;
    this.state = "idle";
  }

  /** 拒绝所有等待中的请求 */
  private rejectAllPending(err: Error): void {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  /** 销毁客户端 */
  destroy(): void {
    this.cleanup();
    this.removeAllListeners();
  }
}
