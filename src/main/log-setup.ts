/**
 * 主进程日志初始化
 * - 挂载 FileTransport 到全局 logger
 * - 注册 IPC 通道接收 renderer 日志
 * - 进程退出时刷写缓冲
 */

import { app, ipcMain } from "electron";
import * as path from "path";
import { logger } from "../core/logger";
import type { LogLevel } from "../core/logger";
import { FileTransport } from "../core/logger/file-transport";

let fileTransport: FileTransport | null = null;

/** 初始化主进程日志（在 app.whenReady 后调用） */
export function initLogging(isDev: boolean): void {
  // 开发模式输出 debug，生产模式输出 info
  logger.setLevel(isDev ? "debug" : "info");

  // 挂载文件 Transport
  const logDir = path.join(app.getPath("userData"), "logs");
  fileTransport = new FileTransport({ dir: logDir });
  logger.addTransport(fileTransport);

  // 注册 IPC 通道：renderer → main 日志转发
  ipcMain.on(
    "log:write",
    (
      _event,
      entry: {
        level: LogLevel;
        message: string;
        source?: string;
        data?: unknown;
        traceId?: string;
      },
    ) => {
      // 直接写入 logger（会同时输出到控制台和文件）
      const prevTrace = logger.getTraceId();
      if (entry.traceId) logger.setTraceId(entry.traceId);
      logger[entry.level](entry.message, entry.data, entry.source ?? "renderer");
      logger.setTraceId(prevTrace);
    },
  );

  // 导出日志接口（供 Help > Export Logs 功能使用）
  ipcMain.handle("log:getPath", () => fileTransport?.getLogPath() ?? null);
  ipcMain.handle("log:getBuffer", (_event, level?: LogLevel) => logger.getBuffer(level));
  ipcMain.handle("log:export", () => logger.export());

  // 进程退出时刷写
  app.on("before-quit", () => {
    logger.info("应用退出", undefined, "main");
    fileTransport?.close();
  });

  logger.info(
    `日志系统初始化完成 (dir=${logDir}, level=${isDev ? "debug" : "info"})`,
    undefined,
    "main",
  );
}
