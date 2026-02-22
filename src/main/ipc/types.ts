/**
 * IPC Handler Shared Types & Context
 *
 * 提供所有 IPC 模块共享的上下文对象，避免循环依赖。
 */
import type { BrowserWindow, IpcMainInvokeEvent, IpcMainEvent } from "electron";

export interface IPCContext {
  getMainWindow: () => BrowserWindow | null;
  isDev: boolean;
  /** 获取当前工作区路径（用于跨模块工作区信任验证） */
  getWorkspacePath: () => string | null;
  /** 设置工作区路径 */
  setWorkspacePath: (p: string | null) => void;
}

/** IPC 操作的统一返回格式 */
export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/** 标准 IPC 错误码 */
export const IPC_ERROR = {
  UNAUTHORIZED: "ERR_UNAUTHORIZED",
  NO_WORKSPACE: "ERR_NO_WORKSPACE",
  ACCESS_DENIED: "ERR_ACCESS_DENIED",
  NOT_FOUND: "ERR_NOT_FOUND",
  ALREADY_EXISTS: "ERR_ALREADY_EXISTS",
  INVALID_PARAM: "ERR_INVALID_PARAM",
  INTERNAL: "ERR_INTERNAL",
  TIMEOUT: "ERR_TIMEOUT",
  CANCELLED: "ERR_CANCELLED",
} as const;

/**
 * 验证 IPC 消息发送者是否为主窗口 webContents
 * 阻止注入的 webview / iframe 发起恶意 IPC 调用
 */
export function validateSender(event: IpcMainInvokeEvent | IpcMainEvent, ctx: IPCContext): boolean {
  const mainWindow = ctx.getMainWindow();
  if (!mainWindow) return false;
  return event.sender === mainWindow.webContents;
}
