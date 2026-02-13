/**
 * IPC Handler Shared Types & Context
 *
 * 提供所有 IPC 模块共享的上下文对象，避免循环依赖。
 */
import type { BrowserWindow } from "electron";

export interface IPCContext {
  getMainWindow: () => BrowserWindow | null;
  isDev: boolean;
}

/** IPC 操作的统一返回格式 */
export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
