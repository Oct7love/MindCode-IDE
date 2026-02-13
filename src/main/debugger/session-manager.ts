/**
 * 调试会话管理器
 * 管理多个 DAP 调试会话的生命周期
 */
import type { DAPStackFrame, DAPVariable } from "./dap-client";
import { DAPClient } from "./dap-client";
import { getAdapter, detectAdapter, type LaunchParams } from "./adapter-registry";
import type { BrowserWindow } from "electron";

export interface DebugSessionInfo {
  id: string;
  language: string;
  state: "initializing" | "running" | "paused" | "stopped";
  config: Record<string, unknown>;
  threadId: number;
}

export class DebugSessionManager {
  private sessions = new Map<string, { client: DAPClient; info: DebugSessionInfo }>();
  private activeSessionId: string | null = null;
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(win: BrowserWindow | null): void {
    this.mainWindow = win;
  }

  /** 向渲染进程发送事件 */
  private sendEvent(event: string, data: unknown): void {
    this.mainWindow?.webContents?.send(`debug:event`, { event, ...(data as object) });
  }

  /** 启动调试会话 */
  async startSession(
    language: string,
    params: LaunchParams,
  ): Promise<{ success: boolean; sessionId?: string; error?: string }> {
    const adapter = getAdapter(language);
    if (!adapter) return { success: false, error: `不支持的语言: ${language}` };

    // 检测适配器可用性
    const detection = detectAdapter(language);
    if (!detection.available) {
      return { success: false, error: `调试适配器不可用: ${detection.error}` };
    }

    const id = `debug-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const client = new DAPClient();

    const info: DebugSessionInfo = {
      id,
      language,
      state: "initializing",
      config: adapter.launchArgs(params),
      threadId: 1,
    };

    try {
      // 1. 启动适配器进程
      await client.spawn(adapter.command, adapter.args);

      // 2. 注册事件监听
      this.setupClientEvents(id, client);

      // 3. 初始化
      await client.initialize("mindcode");

      // 4. 等待 initialized 事件后发送 launch + configurationDone
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("等待 initialized 超时")), 15000);
        client.once("initialized", async () => {
          clearTimeout(timeout);
          try {
            // 设置初始断点（如果有）
            await client.launch(info.config);
            await client.configurationDone();
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });

      info.state = "running";
      this.sessions.set(id, { client, info });
      this.activeSessionId = id;

      console.log(`[Debug] 会话已启动: ${id} (${language})`);
      return { success: true, sessionId: id };
    } catch (err) {
      console.error("[Debug] 启动失败:", err);
      client.destroy();
      return { success: false, error: (err as Error).message };
    }
  }

  /** 停止会话 */
  async stopSession(sessionId?: string): Promise<{ success: boolean; error?: string }> {
    const id = sessionId || this.activeSessionId;
    if (!id) return { success: false, error: "无活跃会话" };

    const session = this.sessions.get(id);
    if (!session) return { success: false, error: `会话不存在: ${id}` };

    try {
      await session.client.disconnect();
    } catch {
      /* 忽略断开错误 */
    }

    session.client.destroy();
    session.info.state = "stopped";
    this.sessions.delete(id);

    if (this.activeSessionId === id) {
      this.activeSessionId = null;
    }

    this.sendEvent("sessionStopped", { sessionId: id });
    return { success: true };
  }

  /** 继续执行 */
  async continue(sessionId?: string): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: "无活跃会话" };

    try {
      await session.client.continue(session.info.threadId);
      session.info.state = "running";
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** 单步跳过 */
  async stepOver(sessionId?: string): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: "无活跃会话" };

    try {
      await session.client.next(session.info.threadId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** 单步进入 */
  async stepInto(sessionId?: string): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: "无活跃会话" };

    try {
      await session.client.stepIn(session.info.threadId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** 单步跳出 */
  async stepOut(sessionId?: string): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: "无活跃会话" };

    try {
      await session.client.stepOut(session.info.threadId);
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** 暂停 */
  async pause(sessionId?: string): Promise<{ success: boolean; error?: string }> {
    const session = this.getSession(sessionId);
    if (!session) return { success: false, error: "无活跃会话" };

    try {
      await session.client.pause(session.info.threadId);
      session.info.state = "paused";
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** 设置断点 */
  async setBreakpoints(
    sourcePath: string,
    breakpoints: Array<{ line: number; condition?: string }>,
  ): Promise<{ success: boolean; breakpoints?: any[]; error?: string }> {
    const session = this.getSession();
    if (!session) return { success: false, error: "无活跃会话" };

    try {
      const result = await session.client.setBreakpoints(sourcePath, breakpoints);
      return { success: true, breakpoints: result };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }

  /** 获取调用栈 */
  async getStackTrace(sessionId?: string): Promise<DAPStackFrame[]> {
    const session = this.getSession(sessionId);
    if (!session) return [];

    try {
      return await session.client.stackTrace(session.info.threadId);
    } catch {
      return [];
    }
  }

  /** 获取变量 */
  async getVariables(sessionId?: string, frameId?: number): Promise<DAPVariable[]> {
    const session = this.getSession(sessionId);
    if (!session) return [];

    try {
      // 先获取栈帧
      const frames = await session.client.stackTrace(session.info.threadId, 0, 1);
      const targetFrameId = frameId ?? frames[0]?.id;
      if (targetFrameId === undefined) return [];

      // 获取作用域
      const scopes = await session.client.scopes(targetFrameId);

      // 获取所有作用域的变量
      const allVars: DAPVariable[] = [];
      for (const scope of scopes) {
        if (!scope.expensive) {
          const vars = await session.client.variables(scope.variablesReference);
          allVars.push(...vars);
        }
      }
      return allVars;
    } catch {
      return [];
    }
  }

  /** 求值表达式 */
  async evaluate(
    expression: string,
    sessionId?: string,
    frameId?: number,
  ): Promise<{ value: string; type?: string } | null> {
    const session = this.getSession(sessionId);
    if (!session) return null;

    try {
      const result = await session.client.evaluate(expression, frameId);
      return { value: result.result, type: result.type };
    } catch {
      return null;
    }
  }

  /** 获取会话信息 */
  getSessionInfo(sessionId?: string): DebugSessionInfo | null {
    const session = this.getSession(sessionId);
    return session?.info || null;
  }

  /** 列出所有会话 */
  listSessions(): DebugSessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info);
  }

  /** 停止所有会话 */
  async stopAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    await Promise.all(ids.map((id) => this.stopSession(id)));
  }

  // ============ 私有方法 ============

  private getSession(sessionId?: string): { client: DAPClient; info: DebugSessionInfo } | null {
    const id = sessionId || this.activeSessionId;
    if (!id) return null;
    return this.sessions.get(id) || null;
  }

  private setupClientEvents(sessionId: string, client: DAPClient): void {
    client.on("stopped", (body: any) => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.info.state = "paused";
        if (body?.threadId) session.info.threadId = body.threadId;
      }
      this.sendEvent("stopped", {
        sessionId,
        reason: body?.reason || "unknown",
        threadId: body?.threadId,
        text: body?.text,
      });
    });

    client.on("continued", () => {
      const session = this.sessions.get(sessionId);
      if (session) session.info.state = "running";
      this.sendEvent("continued", { sessionId });
    });

    client.on("terminated", () => {
      this.stopSession(sessionId);
    });

    client.on("exited", (body: any) => {
      this.sendEvent("exited", { sessionId, exitCode: body?.exitCode });
      this.stopSession(sessionId);
    });

    client.on("output", (body: any) => {
      this.sendEvent("output", {
        sessionId,
        category: body?.category || "console",
        output: body?.output || "",
      });
    });

    client.on("exit", () => {
      const session = this.sessions.get(sessionId);
      if (session) {
        session.info.state = "stopped";
        this.sessions.delete(sessionId);
        if (this.activeSessionId === sessionId) this.activeSessionId = null;
      }
    });
  }
}

/** 全局会话管理器实例 */
export const debugSessionManager = new DebugSessionManager();
