/**
 * LSP集成测试
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LSPClient } from '../../core/lsp/client';

describe('LSP Integration Tests', () => {
  let client: LSPClient;

  beforeAll(async () => {
    // 创建TypeScript LSP客户端
    client = new LSPClient({
      language: 'typescript',
      rootPath: process.cwd()
    });
  });

  afterAll(async () => {
    if (client) {
      await client.stop();
    }
  });

  it('should start language server successfully', async () => {
    const started = await client.start();
    expect(started).toBe(true);
    expect(client.getState()).toBe('running');
  });

  it('should have completion capability', async () => {
    await client.start();
    const info = client.getInfo();
    expect(info.capabilities).toBeDefined();
    expect(info.capabilities.completionProvider).toBeDefined();
  });

  it('should provide completions', async () => {
    await client.start();
    
    const testCode = 'const arr = [1, 2, 3];\narr.';
    const uri = 'file:///test.ts';
    
    await client.openDocument(uri, testCode, 'typescript');
    
    // 请求在arr.后面的补全
    const completions = await client.getCompletion(uri, {
      line: 1,
      character: 4
    });

    expect(Array.isArray(completions)).toBe(true);
    expect(completions.length).toBeGreaterThan(0);
    
    // 应该包含数组方法
    const labels = completions.map(c => c.label);
    expect(labels).toContain('map');
    expect(labels).toContain('filter');
  }, 10000);

  it('should provide hover information', async () => {
    await client.start();
    
    const testCode = 'const message = "Hello";\nconsole.log(message);';
    const uri = 'file:///test2.ts';
    
    await client.openDocument(uri, testCode, 'typescript');
    
    // 请求message变量的hover
    const hover = await client.getHover(uri, {
      line: 1,
      character: 12
    });

    expect(hover).toBeDefined();
    expect(hover?.contents).toBeDefined();
  }, 10000);

  it('should find definition', async () => {
    await client.start();
    
    const testCode = `
function greet(name: string) {
  return "Hello " + name;
}

const result = greet("World");
`;
    const uri = 'file:///test3.ts';
    
    await client.openDocument(uri, testCode, 'typescript');
    
    // 查找greet的定义
    const definition = await client.getDefinition(uri, {
      line: 5,
      character: 16
    });

    expect(definition).toBeDefined();
  }, 10000);
});
