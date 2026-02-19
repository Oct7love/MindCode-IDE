/**
 * 调试器集成测试
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { debuggerManager } from "../../core/debugger";
import type { LaunchConfig } from "../../core/debugger";

describe("Debugger Integration Tests", () => {
  let sessionId: string | null = null;

  afterEach(async () => {
    if (sessionId) {
      await debuggerManager.stopSession(sessionId);
      sessionId = null;
    }
  });

  it("should create debug session", async () => {
    const config: LaunchConfig = {
      name: "Test Node.js",
      type: "node",
      request: "launch",
      program: "${workspaceFolder}/test.js",
      cwd: process.cwd(),
    };

    sessionId = await debuggerManager.startSession(config);
    expect(sessionId).toBeTruthy();

    const session = debuggerManager.getSession(sessionId!);
    expect(session).toBeDefined();
    expect(session?.name).toBe("Test Node.js");
  });

  it("should add and remove breakpoints", () => {
    const file = "/test/example.ts";
    const line = 10;

    // 添加断点
    const bp = debuggerManager.addBreakpoint(file, line);
    expect(bp).toBeDefined();
    expect(bp.file).toBe(file);
    expect(bp.line).toBe(line);
    expect(bp.enabled).toBe(true);

    // 获取断点
    const breakpoints = debuggerManager.getBreakpoints(file);
    expect(breakpoints.length).toBe(1);
    expect(breakpoints[0].id).toBe(bp.id);

    // 移除断点
    debuggerManager.removeBreakpoint(bp.id);
    const afterRemove = debuggerManager.getBreakpoints(file);
    expect(afterRemove.length).toBe(0);
  });

  it("should toggle breakpoints", () => {
    const file = "/test/example.ts";
    const line = 20;

    // 第一次切换: 添加断点
    const bp1 = debuggerManager.toggleBreakpoint(file, line);
    expect(bp1).toBeDefined();
    expect(bp1?.line).toBe(line);

    // 第二次切换: 移除断点
    const bp2 = debuggerManager.toggleBreakpoint(file, line);
    expect(bp2).toBeNull();

    // 验证已移除
    const breakpoints = debuggerManager.getBreakpoints(file);
    expect(breakpoints.length).toBe(0);
  });

  it("should support conditional breakpoints", () => {
    const file = "/test/example.ts";
    const line = 30;
    const condition = "x > 10";

    const bp = debuggerManager.addBreakpoint(file, line, { condition });
    expect(bp.condition).toBe(condition);
  });

  it("should list all sessions", async () => {
    const beforeCount = debuggerManager.listSessions().length;

    const config1: LaunchConfig = {
      name: "Session A",
      type: "node",
      request: "launch",
      program: "test1.js",
    };

    const id1 = await debuggerManager.startSession(config1);
    // 避免 Date.now() ID 冲突
    await new Promise((r) => setTimeout(r, 5));

    const config2: LaunchConfig = {
      name: "Session B",
      type: "node",
      request: "launch",
      program: "test2.js",
    };

    const id2 = await debuggerManager.startSession(config2);

    const sessions = debuggerManager.listSessions();
    // 新增了 2 个 session
    expect(sessions.length).toBe(beforeCount + 2);
    expect(sessions.map((s) => s.name)).toContain("Session A");
    expect(sessions.map((s) => s.name)).toContain("Session B");

    // 清理
    if (id1) await debuggerManager.stopSession(id1);
    if (id2) await debuggerManager.stopSession(id2);
  });
});
