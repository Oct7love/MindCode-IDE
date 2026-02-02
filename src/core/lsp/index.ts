/**
 * LSP 模块入口
 * Language Server Protocol 客户端
 */

export * from './types';
export { LSPClient, getLSPClient, createLSPClient, stopAllLSPClients, type LSPClientConfig } from './client';

// 预定义语言服务器配置
export const LANGUAGE_SERVERS: Record<string, { command: string; args: string[] }> = {
  typescript: { command: 'typescript-language-server', args: ['--stdio'] },
  javascript: { command: 'typescript-language-server', args: ['--stdio'] },
  python: { command: 'pylsp', args: [] },
  rust: { command: 'rust-analyzer', args: [] },
  go: { command: 'gopls', args: [] },
  c: { command: 'clangd', args: [] },
  cpp: { command: 'clangd', args: [] },
};
