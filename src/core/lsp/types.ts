/**
 * LSP (Language Server Protocol) 类型定义
 * 基于 LSP 3.17 规范
 */

// ============ 基础类型 ============

export interface Position { line: number; character: number; }
export interface Range { start: Position; end: Position; }
export interface Location { uri: string; range: Range; }
export interface TextDocumentIdentifier { uri: string; }
export interface TextDocumentPositionParams { textDocument: TextDocumentIdentifier; position: Position; }

// ============ 诊断 ============

export type DiagnosticSeverity = 1 | 2 | 3 | 4; // Error=1, Warning=2, Info=3, Hint=4
export interface Diagnostic { range: Range; message: string; severity?: DiagnosticSeverity; code?: string | number; source?: string; }

// ============ 补全 ============

export type CompletionItemKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25;
export interface CompletionItem { label: string; kind?: CompletionItemKind; detail?: string; documentation?: string; insertText?: string; filterText?: string; sortText?: string; data?: any; }
export interface CompletionList { isIncomplete: boolean; items: CompletionItem[]; }

// ============ Hover ============

export interface MarkupContent { kind: 'plaintext' | 'markdown'; value: string; }
export interface Hover { contents: MarkupContent | string; range?: Range; }

// ============ 符号 ============

export type SymbolKind = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26;
export interface DocumentSymbol { name: string; kind: SymbolKind; range: Range; selectionRange: Range; children?: DocumentSymbol[]; }

// ============ LSP 消息 ============

export interface LSPRequest { jsonrpc: '2.0'; id: number; method: string; params?: any; }
export interface LSPResponse { jsonrpc: '2.0'; id: number; result?: any; error?: { code: number; message: string }; }
export interface LSPNotification { jsonrpc: '2.0'; method: string; params?: any; }

// ============ 服务器能力 ============

export interface ServerCapabilities {
  completionProvider?: { triggerCharacters?: string[]; resolveProvider?: boolean };
  hoverProvider?: boolean;
  definitionProvider?: boolean;
  referencesProvider?: boolean;
  documentSymbolProvider?: boolean;
  diagnosticProvider?: { interFileDependencies: boolean; workspaceDiagnostics: boolean };
}

// ============ 客户端状态 ============

export type LSPClientState = 'stopped' | 'starting' | 'running' | 'error';

export interface LSPClientInfo { language: string; state: LSPClientState; capabilities?: ServerCapabilities; pid?: number; }
