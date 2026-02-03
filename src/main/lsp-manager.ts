/**
 * LSP 服务器管理器 - 主进程端
 * 管理 TypeScript/Python 等语言服务器的启动和通信
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

// 语言服务器配置
export const LANGUAGE_SERVERS: Record<string, { command: string; args: string[]; initOptions?: any }> = {
  typescript: { command: 'npx', args: ['typescript-language-server', '--stdio'], initOptions: { preferences: { includeCompletionsForModuleExports: true } } },
  javascript: { command: 'npx', args: ['typescript-language-server', '--stdio'] },
  python: { command: 'pylsp', args: [] }, // pip install python-lsp-server
  go: { command: 'gopls', args: ['serve'] },
  rust: { command: 'rust-analyzer', args: [] },
};

type LSPState = 'stopped' | 'starting' | 'running' | 'error';

interface LSPServer {
  process: ChildProcess | null;
  state: LSPState;
  capabilities: any;
  pendingRequests: Map<number, { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout }>;
  buffer: string;
  requestId: number;
  rootPath?: string;
}

export class LSPManager extends EventEmitter {
  private servers = new Map<string, LSPServer>();
  private notificationHandlers = new Map<string, Set<(method: string, params: any) => void>>();

  /** 启动语言服务器 */
  async start(language: string, options?: { command?: string; args?: string[]; rootPath?: string }): Promise<{ success: boolean; capabilities?: any; error?: string }> {
    if (this.servers.has(language)) {
      const server = this.servers.get(language)!;
      if (server.state === 'running') return { success: true, capabilities: server.capabilities };
    }
    const config = LANGUAGE_SERVERS[language];
    if (!config && !options?.command) return { success: false, error: `不支持的语言: ${language}` };
    const cmd = options?.command || config.command;
    const args = options?.args || config.args;
    const server: LSPServer = { process: null, state: 'starting', capabilities: null, pendingRequests: new Map(), buffer: '', requestId: 0, rootPath: options?.rootPath };
    this.servers.set(language, server);
    try {
      const proc = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], shell: process.platform === 'win32', cwd: options?.rootPath });
      server.process = proc;
      proc.stdout?.on('data', (data) => this.handleData(language, data.toString()));
      proc.stderr?.on('data', (data) => console.error(`[LSP:${language}] stderr:`, data.toString()));
      proc.on('error', (err) => { console.error(`[LSP:${language}] 启动失败:`, err); server.state = 'error'; });
      proc.on('exit', (code) => { console.log(`[LSP:${language}] 退出: ${code}`); server.state = 'stopped'; this.servers.delete(language); });
      // 发送 initialize 请求
      const initResult = await this.request(language, 'initialize', {
        processId: process.pid,
        rootPath: options?.rootPath || null,
        rootUri: options?.rootPath ? `file://${options.rootPath.replace(/\\/g, '/')}` : null,
        capabilities: {
          textDocument: { completion: { completionItem: { snippetSupport: true } }, hover: { contentFormat: ['markdown', 'plaintext'] }, definition: {}, references: {}, documentSymbol: {} },
          workspace: { workspaceFolders: true }
        },
        initializationOptions: config?.initOptions || {}
      });
      server.capabilities = initResult?.capabilities || {};
      server.state = 'running';
      await this.notify(language, 'initialized', {}); // 发送 initialized 通知
      console.log(`[LSP:${language}] 启动成功, capabilities:`, Object.keys(server.capabilities));
      return { success: true, capabilities: server.capabilities };
    } catch (err: any) {
      server.state = 'error';
      return { success: false, error: err.message };
    }
  }

  /** 停止语言服务器 */
  async stop(language: string): Promise<void> {
    const server = this.servers.get(language);
    if (!server?.process) return;
    try { await this.request(language, 'shutdown', null, 3000); } catch {}
    this.notify(language, 'exit', null);
    server.process.kill();
    this.servers.delete(language);
  }

  /** 发送 LSP 请求 */
  async request(language: string, method: string, params: any, timeout = 10000): Promise<any> {
    const server = this.servers.get(language);
    if (!server?.process) throw new Error('服务器未启动');
    const id = ++server.requestId;
    const message = JSON.stringify({ jsonrpc: '2.0', id, method, params });
    const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { server.pendingRequests.delete(id); reject(new Error('LSP 请求超时')); }, timeout);
      server.pendingRequests.set(id, { resolve, reject, timer });
      server.process!.stdin?.write(content);
    });
  }

  /** 发送 LSP 通知 */
  async notify(language: string, method: string, params: any): Promise<void> {
    const server = this.servers.get(language);
    if (!server?.process) return;
    const message = JSON.stringify({ jsonrpc: '2.0', method, params });
    const content = `Content-Length: ${Buffer.byteLength(message)}\r\n\r\n${message}`;
    server.process.stdin?.write(content);
  }

  /** 注册通知处理器 */
  onNotification(language: string, handler: (method: string, params: any) => void): () => void {
    if (!this.notificationHandlers.has(language)) this.notificationHandlers.set(language, new Set());
    this.notificationHandlers.get(language)!.add(handler);
    return () => this.notificationHandlers.get(language)?.delete(handler);
  }

  /** 获取服务器状态 */
  getStatus(language: string): { state: LSPState; capabilities?: any } | null {
    const server = this.servers.get(language);
    return server ? { state: server.state, capabilities: server.capabilities } : null;
  }

  /** 处理 LSP 输出数据 */
  private handleData(language: string, data: string): void {
    const server = this.servers.get(language);
    if (!server) return;
    server.buffer += data;
    while (true) { // 解析多条消息
      const headerMatch = server.buffer.match(/Content-Length:\s*(\d+)\r\n\r\n/);
      if (!headerMatch) break;
      const contentLength = parseInt(headerMatch[1], 10);
      const headerEnd = server.buffer.indexOf('\r\n\r\n') + 4;
      if (server.buffer.length < headerEnd + contentLength) break;
      const content = server.buffer.slice(headerEnd, headerEnd + contentLength);
      server.buffer = server.buffer.slice(headerEnd + contentLength);
      try {
        const msg = JSON.parse(content);
        if (msg.id !== undefined) { // 响应
          const pending = server.pendingRequests.get(msg.id);
          if (pending) { clearTimeout(pending.timer); server.pendingRequests.delete(msg.id); msg.error ? pending.reject(msg.error) : pending.resolve(msg.result); }
        } else if (msg.method) { // 通知
          this.notificationHandlers.get(language)?.forEach(h => h(msg.method, msg.params));
          this.emit('notification', language, msg.method, msg.params);
        }
      } catch {}
    }
  }
}

// 单例
let _manager: LSPManager | null = null;
export function getLSPManager(): LSPManager { if (!_manager) _manager = new LSPManager(); return _manager; }
