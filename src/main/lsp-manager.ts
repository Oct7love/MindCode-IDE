/**
 * LSP 服务器管理器 - 主进程端
 * 管理 TypeScript/Python 等语言服务器的启动和通信
 */

import type { ChildProcess } from "child_process";
import { spawn, execFile } from "child_process";
import { EventEmitter } from "events";
import { promisify } from "util";
import * as path from "path";

const execFileAsync = promisify(execFile);

// 语言服务器配置
export interface LSPServerConfig {
  command: string;
  args: string[];
  initOptions?: any;
  detectCommand: string; // 检测命令
  installHint: string; // 安装提示
  alternativeCommand?: string; // 备选命令
  alternativeArgs?: string[]; // 备选参数
  fileExtensions: string[]; // 关联的文件扩展名
}

export const LANGUAGE_SERVERS: Record<string, LSPServerConfig> = {
  typescript: {
    command: "npx",
    args: ["typescript-language-server", "--stdio"],
    initOptions: { preferences: { includeCompletionsForModuleExports: true } },
    detectCommand: process.platform === "win32" ? "where npx" : "which npx",
    installHint: "npm install -g typescript-language-server typescript",
    fileExtensions: [".ts", ".tsx", ".js", ".jsx"],
  },
  javascript: {
    command: "npx",
    args: ["typescript-language-server", "--stdio"],
    detectCommand: process.platform === "win32" ? "where npx" : "which npx",
    installHint: "npm install -g typescript-language-server",
    fileExtensions: [".js", ".jsx"],
  },
  python: {
    command: "pylsp",
    args: [],
    detectCommand: process.platform === "win32" ? "where pylsp" : "which pylsp",
    installHint: "pip install python-lsp-server",
    alternativeCommand: "pyright-langserver",
    alternativeArgs: ["--stdio"],
    fileExtensions: [".py"],
  },
  go: {
    command: "gopls",
    args: ["serve"],
    detectCommand: process.platform === "win32" ? "where gopls" : "which gopls",
    installHint: "go install golang.org/x/tools/gopls@latest",
    fileExtensions: [".go"],
  },
  rust: {
    command: "rust-analyzer",
    args: [],
    detectCommand: process.platform === "win32" ? "where rust-analyzer" : "which rust-analyzer",
    installHint: "rustup component add rust-analyzer",
    fileExtensions: [".rs"],
  },
};

type LSPState = "stopped" | "starting" | "running" | "error";

interface LSPServer {
  process: ChildProcess | null;
  state: LSPState;
  capabilities: any;
  pendingRequests: Map<
    number,
    { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }
  >;
  buffer: string;
  requestId: number;
  rootPath?: string;
}

export class LSPManager extends EventEmitter {
  private servers = new Map<string, LSPServer>();
  private notificationHandlers = new Map<string, Set<(method: string, params: any) => void>>();
  private healthCheckTimers = new Map<string, NodeJS.Timeout>();

  /** 检测语言服务器是否可用 */
  async detect(
    language: string,
  ): Promise<{ available: boolean; command: string; installHint?: string }> {
    const config = LANGUAGE_SERVERS[language];
    if (!config) return { available: false, command: "", installHint: `不支持的语言: ${language}` };

    try {
      // 使用 execFile 避免 shell 注入（将 detectCommand 拆分为命令+参数）
      const detectCmd = process.platform === "win32" ? "where" : "which";
      await execFileAsync(detectCmd, [config.command], { timeout: 5000 });
      return { available: true, command: config.command };
    } catch {
      // 尝试备选命令
      if (config.alternativeCommand) {
        try {
          const detectCmd = process.platform === "win32" ? "where" : "which";
          await execFileAsync(detectCmd, [config.alternativeCommand], { timeout: 5000 });
          return { available: true, command: config.alternativeCommand };
        } catch {}
      }
      return { available: false, command: config.command, installHint: config.installHint };
    }
  }

  /** 启动语言服务器 */
  async start(
    language: string,
    options?: { command?: string; args?: string[]; rootPath?: string },
  ): Promise<{ success: boolean; capabilities?: any; error?: string }> {
    if (this.servers.has(language)) {
      const server = this.servers.get(language)!;
      if (server.state === "running") return { success: true, capabilities: server.capabilities };
    }
    const config = LANGUAGE_SERVERS[language];
    if (!config && !options?.command) return { success: false, error: `不支持的语言: ${language}` };
    const cmd = options?.command || config.command;
    const args = options?.args || config.args;
    const server: LSPServer = {
      process: null,
      state: "starting",
      capabilities: null,
      pendingRequests: new Map(),
      buffer: "",
      requestId: 0,
      rootPath: options?.rootPath,
    };
    this.servers.set(language, server);
    try {
      // 校验命令名安全性（禁止 Shell 元字符）
      if (/[;&|`$()<>!{}\\"'\n\r]/.test(cmd)) {
        throw new Error(`不安全的 LSP 命令: ${cmd}`);
      }
      // Windows 上对 npm 系工具使用 .cmd 后缀直接调用，避免 cmd.exe /c 注入
      const resolvedCmd =
        process.platform === "win32" && ["npx", "npm", "yarn", "pnpm"].includes(cmd)
          ? `${cmd}.cmd`
          : cmd;
      const proc = spawn(resolvedCmd, args, {
        stdio: ["pipe", "pipe", "pipe"],
        shell: false,
        cwd: options?.rootPath,
        windowsHide: true,
      });
      server.process = proc;
      proc.stdout?.on("data", (data) => this.handleData(language, data.toString()));
      proc.stderr?.on("data", (data) =>
        console.error(`[LSP:${language}] stderr:`, data.toString()),
      );
      proc.on("error", (err) => {
        console.error(`[LSP:${language}] 启动失败:`, err);
        server.state = "error";
      });
      proc.on("exit", (code) => {
        console.warn(`[LSP:${language}] 进程退出: code=${code}`);
        server.state = "stopped";
        this.servers.delete(language);
        // 非正常退出时自动重启（最多3次）
        if (code !== 0 && (server as any)._restartCount < 3) {
          (server as any)._restartCount = ((server as any)._restartCount || 0) + 1;
          console.log(`[LSP:${language}] 尝试自动重启 (${(server as any)._restartCount}/3)`);
          setTimeout(() => this.start(language, { rootPath: server.rootPath }), 2000);
        }
      });
      // 发送 initialize 请求
      const initResult = await this.request(language, "initialize", {
        processId: process.pid,
        rootPath: options?.rootPath || null,
        rootUri: options?.rootPath ? `file://${options.rootPath.replace(/\\/g, "/")}` : null,
        capabilities: {
          textDocument: {
            completion: { completionItem: { snippetSupport: true } },
            hover: { contentFormat: ["markdown", "plaintext"] },
            definition: {},
            references: {},
            documentSymbol: {},
          },
          workspace: { workspaceFolders: true },
        },
        initializationOptions: config?.initOptions || {},
      });
      server.capabilities = initResult?.capabilities || {};
      server.state = "running";
      await this.notify(language, "initialized", {}); // 发送 initialized 通知
      console.log(`[LSP:${language}] 启动成功, capabilities:`, Object.keys(server.capabilities));
      // 启动心跳检测
      this.startHealthCheck(language);
      return { success: true, capabilities: server.capabilities };
    } catch (err: any) {
      server.state = "error";
      return { success: false, error: err.message };
    }
  }

  /** 停止语言服务器 */
  async stop(language: string): Promise<void> {
    this.stopHealthCheck(language);
    const server = this.servers.get(language);
    if (!server?.process) return;
    try {
      await this.request(language, "shutdown", null, 3000);
    } catch {}
    this.notify(language, "exit", null);
    server.process.kill();
    this.servers.delete(language);
  }

  /** 发送 LSP 请求 */
  async request(language: string, method: string, params: any, timeout = 10000): Promise<any> {
    const server = this.servers.get(language);
    if (!server?.process) throw new Error("服务器未启动");
    const id = ++server.requestId;
    const message = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        server.pendingRequests.delete(id);
        reject(new Error("LSP 请求超时"));
      }, timeout);
      server.pendingRequests.set(id, { resolve, reject, timer });
      server.process!.stdin?.write(content);
    });
  }

  /** 发送 LSP 通知 */
  async notify(language: string, method: string, params: any): Promise<void> {
    const server = this.servers.get(language);
    if (!server?.process) return;
    const message = JSON.stringify({ jsonrpc: "2.0", method, params });
    const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;
    server.process.stdin?.write(content);
  }

  /** 注册通知处理器 */
  onNotification(language: string, handler: (method: string, params: any) => void): () => void {
    if (!this.notificationHandlers.has(language))
      this.notificationHandlers.set(language, new Set());
    this.notificationHandlers.get(language)!.add(handler);
    return () => this.notificationHandlers.get(language)?.delete(handler);
  }

  /** 获取服务器状态 */
  getStatus(language: string): { state: LSPState; capabilities?: any } | null {
    const server = this.servers.get(language);
    return server ? { state: server.state, capabilities: server.capabilities } : null;
  }

  /** 心跳检测 */
  private startHealthCheck(language: string): void {
    this.stopHealthCheck(language);
    const timer = setInterval(async () => {
      const server = this.servers.get(language);
      if (!server || server.state !== "running") {
        this.stopHealthCheck(language);
        return;
      }
      try {
        // 发送一个轻量级请求作为心跳（LSP 没有标准心跳，用 $/cancelRequest 测试连接）
        await this.request(language, "$/alive", null, 5000);
      } catch {
        // 心跳失败不立即重启（可能是服务器不支持该方法），仅在连续失败时处理
        console.warn(`[LSP:${language}] 心跳无响应`);
      }
    }, 30000);
    this.healthCheckTimers.set(language, timer);
  }

  private stopHealthCheck(language: string): void {
    const timer = this.healthCheckTimers.get(language);
    if (timer) {
      clearInterval(timer);
      this.healthCheckTimers.delete(language);
    }
  }

  /** 处理 LSP 输出数据 */
  private handleData(language: string, data: string): void {
    const server = this.servers.get(language);
    if (!server) return;
    server.buffer += data;
    while (true) {
      // 解析多条消息
      const headerMatch = server.buffer.match(/Content-Length:\s*(\d+)\r\n\r\n/);
      if (!headerMatch) break;
      const contentLength = parseInt(headerMatch[1], 10);
      const headerEnd = server.buffer.indexOf("\r\n\r\n") + 4;
      if (server.buffer.length < headerEnd + contentLength) break;
      const content = server.buffer.slice(headerEnd, headerEnd + contentLength);
      server.buffer = server.buffer.slice(headerEnd + contentLength);
      try {
        const msg = JSON.parse(content);
        if (msg.id !== undefined) {
          // 响应
          const pending = server.pendingRequests.get(msg.id);
          if (pending) {
            clearTimeout(pending.timer);
            server.pendingRequests.delete(msg.id);
            msg.error ? pending.reject(msg.error) : pending.resolve(msg.result);
          }
        } else if (msg.method) {
          // 通知
          this.notificationHandlers.get(language)?.forEach((h) => h(msg.method, msg.params));
          this.emit("notification", language, msg.method, msg.params);
        }
      } catch {}
    }
  }
}

// 单例
let _manager: LSPManager | null = null;
export function getLSPManager(): LSPManager {
  if (!_manager) _manager = new LSPManager();
  return _manager;
}
