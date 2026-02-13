/**
 * Debugger IPC Handlers
 *
 * 基于 DAP (Debug Adapter Protocol) 的调试 IPC 处理器
 * 使用主进程的 debugSessionManager 管理真实调试会话
 */
import { ipcMain } from "electron";
import { debugSessionManager, detectAdapter, getSupportedLanguages } from "../debugger";
import type { IPCContext } from "./types";

export function registerDebugHandlers(ctx: IPCContext): void {
  // 将主窗口引用传递给会话管理器
  const mainWindow = ctx.getMainWindow();
  if (mainWindow) debugSessionManager.setMainWindow(mainWindow);

  // 启动调试会话
  ipcMain.handle(
    "debug:start",
    async (
      _event,
      config: {
        type: string;
        program: string;
        args?: string[];
        cwd?: string;
        env?: Record<string, string>;
        stopOnEntry?: boolean;
      },
    ) => {
      try {
        // 更新主窗口引用
        const win = ctx.getMainWindow();
        if (win) debugSessionManager.setMainWindow(win);

        return await debugSessionManager.startSession(config.type, {
          program: config.program,
          args: config.args,
          cwd: config.cwd,
          env: config.env,
          stopOnEntry: config.stopOnEntry,
        });
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // 停止调试会话
  ipcMain.handle("debug:stop", async (_event, sessionId?: string) => {
    try {
      return await debugSessionManager.stopSession(sessionId);
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 继续执行
  ipcMain.handle("debug:continue", async (_event, sessionId?: string) => {
    try {
      return await debugSessionManager.continue(sessionId);
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 单步跳过
  ipcMain.handle("debug:stepOver", async (_event, sessionId?: string) => {
    try {
      return await debugSessionManager.stepOver(sessionId);
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 单步进入
  ipcMain.handle("debug:stepInto", async (_event, sessionId?: string) => {
    try {
      return await debugSessionManager.stepInto(sessionId);
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 单步跳出
  ipcMain.handle("debug:stepOut", async (_event, sessionId?: string) => {
    try {
      return await debugSessionManager.stepOut(sessionId);
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 暂停
  ipcMain.handle("debug:pause", async (_event, sessionId?: string) => {
    try {
      return await debugSessionManager.pause(sessionId);
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 重启（停止后重新启动）
  ipcMain.handle("debug:restart", async (_event, sessionId?: string) => {
    try {
      const session = debugSessionManager.getSessionInfo(sessionId);
      if (!session) return { success: false, error: "无活跃会话" };

      await debugSessionManager.stopSession(sessionId);

      // 从原始配置重新启动
      const config = session.config as {
        program?: string;
        args?: string[];
        cwd?: string;
        env?: Record<string, string>;
        stopOnEntry?: boolean;
      };
      return await debugSessionManager.startSession(session.language, {
        program: config.program || "",
        args: config.args,
        cwd: config.cwd,
        env: config.env,
        stopOnEntry: config.stopOnEntry,
      });
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 设置断点
  ipcMain.handle(
    "debug:setBreakpoints",
    async (_event, file: string, breakpoints: Array<{ line: number; condition?: string }>) => {
      try {
        return await debugSessionManager.setBreakpoints(file, breakpoints);
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // 兼容旧 API：添加断点
  ipcMain.handle(
    "debug:addBreakpoint",
    async (_event, file: string, line: number, options?: { condition?: string }) => {
      try {
        const result = await debugSessionManager.setBreakpoints(file, [
          { line, condition: options?.condition },
        ]);
        return { success: result.success, breakpoint: result.breakpoints?.[0] };
      } catch (err: unknown) {
        return { success: false, error: (err as Error).message };
      }
    },
  );

  // 兼容旧 API：移除断点（设置空断点列表）
  ipcMain.handle("debug:removeBreakpoint", async (_event, _breakpointId: string) => {
    // DAP 不支持按 ID 移除单个断点，需要客户端跟踪并重新设置整个文件的断点
    return { success: true };
  });

  // 兼容旧 API：切换断点
  ipcMain.handle("debug:toggleBreakpoint", async (_event, _file: string, _line: number) => {
    return { success: true };
  });

  // 获取断点
  ipcMain.handle("debug:getBreakpoints", async (_event, _file?: string) => {
    return { success: true, breakpoints: [] };
  });

  // 获取变量
  ipcMain.handle("debug:getVariables", async (_event, sessionId?: string, frameId?: number) => {
    try {
      const variables = await debugSessionManager.getVariables(sessionId, frameId);
      return { success: true, variables };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 求值表达式
  ipcMain.handle("debug:evaluate", async (_event, expression: string, frameId?: number) => {
    try {
      const result = await debugSessionManager.evaluate(expression, undefined, frameId);
      return { success: true, result };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 获取调用栈
  ipcMain.handle("debug:stackTrace", async (_event, sessionId?: string) => {
    try {
      const frames = await debugSessionManager.getStackTrace(sessionId);
      return { success: true, frames };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 获取会话信息
  ipcMain.handle("debug:getSession", async (_event, sessionId?: string) => {
    try {
      const session = debugSessionManager.getSessionInfo(sessionId);
      return { success: true, session };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 列出所有会话
  ipcMain.handle("debug:listSessions", async () => {
    try {
      const sessions = debugSessionManager.listSessions();
      return { success: true, sessions };
    } catch (err: unknown) {
      return { success: false, error: (err as Error).message };
    }
  });

  // 检测适配器是否可用
  ipcMain.handle("debug:detect", async (_event, language: string) => {
    try {
      return detectAdapter(language);
    } catch (err: unknown) {
      return { available: false, error: (err as Error).message };
    }
  });

  // 获取支持的语言列表
  ipcMain.handle("debug:supportedLanguages", async () => {
    return { languages: getSupportedLanguages() };
  });
}
