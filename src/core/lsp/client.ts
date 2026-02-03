/**
 * LSP Client - Language Server Protocol 客户端
 * 通过 IPC 与主进程中的语言服务器通信（简化版直连 API）
 */

import type { Position, Diagnostic, CompletionItem, Hover, Location, DocumentSymbol, ServerCapabilities, LSPClientState, LSPClientInfo } from './types';

export interface LSPClientConfig { language: string; serverCommand?: string; serverArgs?: string[]; rootPath?: string; }

type LSPEventHandler = (data: any) => void;
const win = window as any; // 类型断言简化

export class LSPClient {
  private config: LSPClientConfig;
  private state: LSPClientState = 'stopped';
  private capabilities: ServerCapabilities | null = null;
  private eventHandlers = new Map<string, Set<LSPEventHandler>>();
  private openDocuments = new Set<string>();
  private cleanupNotifications?: () => void;

  constructor(config: LSPClientConfig) { this.config = config; }

  getState(): LSPClientState { return this.state; } // 获取状态
  getInfo(): LSPClientInfo { return { language: this.config.language, state: this.state, capabilities: this.capabilities || undefined }; }

  /** 启动语言服务器 */
  async start(): Promise<boolean> {
    if (this.state === 'running') return true;
    this.state = 'starting';
    try {
      if (!win.mindcode?.lsp?.start) { this.state = 'error'; return false; }
      const result = await win.mindcode.lsp.start(this.config.language, { command: this.config.serverCommand, args: this.config.serverArgs, rootPath: this.config.rootPath });
      if (result.success) {
        this.capabilities = result.capabilities || null;
        this.state = 'running';
        this.setupEventListeners();
        console.log(`[LSP] ${this.config.language} 服务器已启动`);
        return true;
      }
      this.state = 'error';
      return false;
    } catch (err) { console.error('[LSP] 启动失败:', err); this.state = 'error'; return false; }
  }

  /** 停止语言服务器 */
  async stop(): Promise<void> {
    if (this.state !== 'running') return;
    this.cleanupNotifications?.();
    try { if (win.mindcode?.lsp?.stop) await win.mindcode.lsp.stop(this.config.language); } catch {}
    this.state = 'stopped';
    this.openDocuments.clear();
  }

  /** 打开文档 */
  async openDocument(uri: string, text: string, languageId?: string): Promise<void> {
    if (this.state !== 'running') return;
    this.openDocuments.add(uri);
    await this.notify('textDocument/didOpen', { textDocument: { uri, languageId: languageId || this.config.language, version: 1, text } });
  }

  /** 关闭文档 */
  async closeDocument(uri: string): Promise<void> {
    if (!this.openDocuments.has(uri)) return;
    this.openDocuments.delete(uri);
    await this.notify('textDocument/didClose', { textDocument: { uri } });
  }

  /** 文档变更 */
  async changeDocument(uri: string, version: number, changes: Array<{ range?: { start: Position; end: Position }; text: string }>): Promise<void> {
    if (this.state !== 'running') return;
    await this.notify('textDocument/didChange', { textDocument: { uri, version }, contentChanges: changes });
  }

  /** 获取补全 */
  async getCompletion(uri: string, position: Position): Promise<CompletionItem[]> {
    if (this.state !== 'running' || !this.capabilities?.completionProvider) return [];
    const result = await this.request('textDocument/completion', { textDocument: { uri }, position });
    return Array.isArray(result) ? result : result?.items || [];
  }

  /** 获取 Hover 信息 */
  async getHover(uri: string, position: Position): Promise<Hover | null> {
    if (this.state !== 'running' || !this.capabilities?.hoverProvider) return null;
    return await this.request('textDocument/hover', { textDocument: { uri }, position });
  }

  /** 跳转定义 */
  async getDefinition(uri: string, position: Position): Promise<Location | Location[] | null> {
    if (this.state !== 'running' || !this.capabilities?.definitionProvider) return null;
    return await this.request('textDocument/definition', { textDocument: { uri }, position });
  }

  /** 查找引用 */
  async getReferences(uri: string, position: Position, includeDeclaration = true): Promise<Location[]> {
    if (this.state !== 'running' || !this.capabilities?.referencesProvider) return [];
    return await this.request('textDocument/references', { textDocument: { uri }, position, context: { includeDeclaration } }) || [];
  }

  /** 获取文档符号 */
  async getDocumentSymbols(uri: string): Promise<DocumentSymbol[]> {
    if (this.state !== 'running' || !this.capabilities?.documentSymbolProvider) return [];
    return await this.request('textDocument/documentSymbol', { textDocument: { uri } }) || [];
  }

  /** 获取诊断 */
  async getDiagnostics(uri: string): Promise<Diagnostic[]> {
    if (this.state !== 'running') return [];
    return await this.request('textDocument/diagnostic', { textDocument: { uri } }).then(r => r?.items || []).catch(() => []);
  }

  /** 监听诊断事件 */
  onDiagnostics(handler: (uri: string, diagnostics: Diagnostic[]) => void): () => void {
    return this.on('textDocument/publishDiagnostics', (data) => handler(data.uri, data.diagnostics));
  }

  // ============ 私有方法 ============

  private async request(method: string, params: any): Promise<any> {
    if (!win.mindcode?.lsp?.request) throw new Error('LSP not available');
    const result = await win.mindcode.lsp.request(this.config.language, method, params);
    if (!result.success) throw new Error(result.error || 'LSP request failed');
    return result.data;
  }

  private async notify(method: string, params: any): Promise<void> {
    if (win.mindcode?.lsp?.notify) await win.mindcode.lsp.notify(this.config.language, method, params);
  }

  private on(event: string, handler: LSPEventHandler): () => void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set());
    this.eventHandlers.get(event)!.add(handler);
    return () => this.eventHandlers.get(event)?.delete(handler);
  }

  private setupEventListeners(): void {
    if (win.mindcode?.lsp?.onNotification) {
      this.cleanupNotifications = win.mindcode.lsp.onNotification((data: { language: string; method: string; params: any }) => {
        if (data.language !== this.config.language) return;
        const handlers = this.eventHandlers.get(data.method);
        if (handlers) handlers.forEach(h => h(data.params));
      });
    }
  }
}

// ============ 工厂函数 ============

const clients = new Map<string, LSPClient>();

export function getLSPClient(language: string): LSPClient | undefined { return clients.get(language); }

export async function createLSPClient(config: LSPClientConfig): Promise<LSPClient> {
  let client = clients.get(config.language);
  if (!client) { client = new LSPClient(config); clients.set(config.language, client); }
  return client;
}

export async function stopAllLSPClients(): Promise<void> {
  for (const client of clients.values()) await client.stop();
  clients.clear();
}
