/**
 * LSP 客户端集成测试
 * 测试 LSPClient 与 mock IPC 的交互
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { LSPClient } from "../../core/lsp/client";

describe("LSP Integration Tests", () => {
  let client: LSPClient;

  beforeEach(() => {
    // 配置 mock 使 lsp.start 返回 capabilities
    (window as any).mindcode.lsp.start.mockResolvedValue({
      success: true,
      capabilities: {
        completionProvider: { triggerCharacters: ["."] },
        hoverProvider: true,
        definitionProvider: true,
      },
    });
    (window as any).mindcode.lsp.request.mockResolvedValue(null);

    client = new LSPClient({
      language: "typescript",
      rootPath: process.cwd(),
    });
  });

  afterAll(async () => {
    if (client) await client.stop();
  });

  it("should start language server successfully", async () => {
    const started = await client.start();
    expect(started).toBe(true);
    expect(client.getState()).toBe("running");
  });

  it("should have completion capability", async () => {
    await client.start();
    const info = client.getInfo();
    expect(info.capabilities).toBeDefined();
    expect(info.capabilities!.completionProvider).toBeDefined();
  });

  it("should provide completions from mock", async () => {
    // mock 补全响应（需要 IPCResult 格式）
    (window as any).mindcode.lsp.request.mockResolvedValue({
      success: true,
      data: [
        { label: "map", kind: 2 },
        { label: "filter", kind: 2 },
        { label: "reduce", kind: 2 },
      ],
    });

    await client.start();
    const testCode = "const arr = [1, 2, 3];\narr.";
    const uri = "file:///test.ts";
    await client.openDocument(uri, testCode, "typescript");

    const completions = await client.getCompletion(uri, { line: 1, character: 4 });
    expect(Array.isArray(completions)).toBe(true);
    expect(completions.length).toBeGreaterThan(0);
    const labels = completions.map((c: any) => c.label);
    expect(labels).toContain("map");
    expect(labels).toContain("filter");
  });

  it("should provide hover information from mock", async () => {
    (window as any).mindcode.lsp.request.mockResolvedValue({
      success: true,
      data: {
        contents: { kind: "markdown", value: "```typescript\nconst message: string\n```" },
      },
    });

    await client.start();
    const testCode = 'const message = "Hello";\nconsole.log(message);';
    const uri = "file:///test2.ts";
    await client.openDocument(uri, testCode, "typescript");

    const hover = await client.getHover(uri, { line: 1, character: 12 });
    expect(hover).toBeDefined();
    expect(hover?.contents).toBeDefined();
  });

  it("should find definition from mock", async () => {
    (window as any).mindcode.lsp.request.mockResolvedValue({
      success: true,
      data: {
        uri: "file:///test3.ts",
        range: { start: { line: 1, character: 9 }, end: { line: 1, character: 14 } },
      },
    });

    await client.start();
    const testCode = `
function greet(name: string) {
  return "Hello " + name;
}
const result = greet("World");
`;
    const uri = "file:///test3.ts";
    await client.openDocument(uri, testCode, "typescript");

    const definition = await client.getDefinition(uri, { line: 4, character: 16 });
    expect(definition).toBeDefined();
  });

  it("should handle start failure", async () => {
    (window as any).mindcode.lsp.start.mockResolvedValue({
      success: false,
      error: "Server not found",
    });
    const started = await client.start();
    expect(started).toBe(false);
    expect(client.getState()).toBe("error");
  });
});
