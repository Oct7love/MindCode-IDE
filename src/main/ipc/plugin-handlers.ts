/**
 * 插件管理 IPC 处理器
 * 主进程端插件安装、卸载、验证
 */

import { ipcMain } from "electron";
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import type { IPCContext, IPCResult } from "./types";
import { logger } from "../../core/logger";

const log = logger.child("PluginIPC");

/** 插件目录根路径 */
function getPluginsDir(): string {
  const appPath = process.env.PORTABLE_EXECUTABLE_DIR || process.cwd();
  return path.join(appPath, "plugins");
}

/** 确保插件目录存在 */
function ensurePluginsDir(): string {
  const dir = getPluginsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/** 计算文件 SHA256 */
function fileChecksum(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/** 安全路径检查 */
function isSafePath(target: string, base: string): boolean {
  const resolved = fs.existsSync(target) ? fs.realpathSync(target) : path.resolve(target);
  const resolvedBase = fs.existsSync(base) ? fs.realpathSync(base) : path.resolve(base);
  return resolved.startsWith(resolvedBase + path.sep) || resolved === resolvedBase;
}

export function registerPluginHandlers(ctx: IPCContext): void {
  // 列出已安装插件
  ipcMain.handle("plugins:list", async (): Promise<IPCResult> => {
    try {
      const dir = ensurePluginsDir();
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const plugins = [];
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const manifestPath = path.join(dir, entry.name, "manifest.json");
        if (!fs.existsSync(manifestPath)) continue;
        try {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
          const checksum = fileChecksum(manifestPath);
          plugins.push({ ...manifest, _checksum: checksum, _dir: entry.name });
        } catch {
          log.warn(`无效插件 manifest: ${entry.name}`);
        }
      }
      return { success: true, data: plugins };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  // 获取插件详情（含完整性校验）
  ipcMain.handle("plugins:verify", async (_, pluginId: string): Promise<IPCResult> => {
    try {
      const dir = ensurePluginsDir();
      const pluginDir = path.join(dir, pluginId);
      if (!isSafePath(pluginDir, dir)) {
        return { success: false, error: "路径安全检查失败" };
      }
      const manifestPath = path.join(pluginDir, "manifest.json");
      if (!fs.existsSync(manifestPath)) {
        return { success: false, error: "插件不存在" };
      }
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      const checksum = fileChecksum(manifestPath);
      // 检查入口文件
      const mainPath = path.join(pluginDir, manifest.main || "index.js");
      let mainChecksum = "";
      const warnings: string[] = [];
      if (fs.existsSync(mainPath)) {
        mainChecksum = fileChecksum(mainPath);
        // 简单静态分析
        const source = fs.readFileSync(mainPath, "utf-8");
        const dangerousPatterns: Array<[RegExp, string]> = [
          [/\bchild_process\b/, "引用 child_process"],
          [/\beval\s*\(/, "使用 eval()"],
          [/\bnew\s+Function\s*\(/, "使用 new Function()"],
          [/process\.env/, "访问 process.env"],
        ];
        for (const [regex, desc] of dangerousPatterns) {
          if (regex.test(source)) warnings.push(desc);
        }
      }
      return {
        success: true,
        data: {
          manifest,
          manifestChecksum: checksum,
          mainChecksum,
          warnings,
          verified: warnings.length === 0,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  // 卸载插件（清理文件）
  ipcMain.handle("plugins:uninstall", async (_, pluginId: string): Promise<IPCResult> => {
    try {
      const dir = ensurePluginsDir();
      const pluginDir = path.join(dir, pluginId);
      if (!isSafePath(pluginDir, dir)) {
        return { success: false, error: "路径安全检查失败" };
      }
      if (!fs.existsSync(pluginDir)) {
        return { success: false, error: "插件目录不存在" };
      }
      // 递归删除插件目录
      fs.rmSync(pluginDir, { recursive: true, force: true });
      log.info(`已卸载插件: ${pluginId}`);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: msg };
    }
  });

  // 获取插件目录路径
  ipcMain.handle("plugins:getDir", async (): Promise<IPCResult<string>> => {
    return { success: true, data: ensurePluginsDir() };
  });

  log.info("插件 IPC 处理器已注册");
}
