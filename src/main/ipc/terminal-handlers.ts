/**
 * Terminal IPC Handlers
 *
 * 基于 node-pty 的真实 PTY 会话管理器
 * 包含命令安全验证（白名单 + 黑名单）用于回退模式
 */
import { ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import { exec } from "child_process";
import type { IPCContext } from "./types";

const execAsync = promisify(exec);

// node-pty 动态导入（原生模块可能不可用）
let pty: typeof import("node-pty") | null = null;
try {
  pty = require("node-pty");
  console.log("[Terminal] node-pty 已加载");
} catch (err) {
  console.warn("[Terminal] node-pty 不可用，回退到 exec 模式", err);
}

/** PTY 会话接口 */
interface PtySession {
  id: string;
  pty: import("node-pty").IPty | null;
  cwd: string;
}

/** 会话存储 */
const sessions = new Map<string, PtySession>();

/** 命令执行超时（ms） */
const COMMAND_TIMEOUT_MS = 60000;

/** 安全的命令白名单（仅用于 exec 回退模式） */
const ALLOWED_COMMAND_PREFIXES = [
  "npm",
  "npx",
  "node",
  "yarn",
  "pnpm",
  "git",
  "python",
  "python3",
  "pip",
  "pip3",
  "cargo",
  "rustc",
  "go",
  "java",
  "javac",
  "mvn",
  "gradle",
  "dotnet",
  "make",
  "cmake",
  "ls",
  "dir",
  "cd",
  "pwd",
  "echo",
  "cat",
  "type",
  "mkdir",
  "rmdir",
  "cp",
  "mv",
  "rm",
  "curl",
  "wget",
  "tar",
  "unzip",
  "zip",
  "tsc",
  "eslint",
  "prettier",
  "jest",
  "vitest",
  "mocha",
  "docker",
  "docker-compose",
  "code",
  "cursor",
];

/** 危险命令黑名单（仅用于 exec 回退模式） */
const DANGEROUS_COMMANDS = [
  "rm -rf /",
  "rm -rf /*",
  "del /f /s /q c:\\",
  "format",
  "fdisk",
  "mkfs",
  ":(){:|:&};:", // fork bomb
  "dd if=/dev/zero",
  "dd if=/dev/random",
  "> /dev/sda",
  "> /dev/hda",
  "chmod -R 777 /",
  "chmod -R 000 /",
  "shutdown",
  "reboot",
  "halt",
  "poweroff",
  "wget -O- | sh",
  "curl | sh",
  "curl | bash",
];

/**
 * 验证命令安全性（仅用于 exec 回退模式）
 */
function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  const trimmedCmd = command.trim().toLowerCase();

  for (const dangerous of DANGEROUS_COMMANDS) {
    if (trimmedCmd.includes(dangerous.toLowerCase())) {
      return { safe: false, reason: `Dangerous command blocked: ${dangerous}` };
    }
  }

  const cmdParts = trimmedCmd.split(/\s+/);
  const cmdName = cmdParts[0].replace(/^\.\//, "").replace(/\.exe$/i, "");

  const isAllowed = ALLOWED_COMMAND_PREFIXES.some(
    (prefix) =>
      cmdName === prefix || cmdName.endsWith("/" + prefix) || cmdName.endsWith("\\" + prefix),
  );

  if (!isAllowed) {
    return { safe: false, reason: `Command not in whitelist: ${cmdName}` };
  }

  return { safe: true };
}

/**
 * 获取默认 Shell
 */
function getDefaultShell(): string {
  if (process.platform === "win32") {
    return "powershell.exe";
  }
  return process.env.SHELL || "/bin/bash";
}

export function registerTerminalHandlers(ctx: IPCContext): void {
  // 创建 PTY 会话
  ipcMain.handle("terminal:create", async (_event, options?: { cwd?: string; shell?: string }) => {
    try {
      if (!pty) {
        return { success: false, error: "node-pty 不可用，请使用 terminal:execute 回退模式" };
      }

      const id = `pty-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const cwd = options?.cwd || process.cwd();
      const shell = options?.shell || getDefaultShell();

      // 验证工作目录
      if (!fs.existsSync(cwd)) {
        return { success: false, error: `工作目录不存在: ${cwd}` };
      }

      // 创建 PTY 实例
      const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 80,
        rows: 30,
        cwd,
        env: process.env as { [key: string]: string },
      });

      // 存储会话
      sessions.set(id, { id, pty: ptyProcess, cwd });

      // 监听 PTY 输出
      ptyProcess.onData((data) => {
        const mainWindow = ctx.getMainWindow();
        mainWindow?.webContents.send("terminal:data", { id, data });
      });

      // 监听 PTY 退出
      ptyProcess.onExit(({ exitCode }) => {
        const mainWindow = ctx.getMainWindow();
        mainWindow?.webContents.send("terminal:exit", { id, exitCode });
        sessions.delete(id);
      });

      console.log(`[Terminal] PTY 会话已创建: ${id}, shell: ${shell}, cwd: ${cwd}`);
      return { success: true, id };
    } catch (error: unknown) {
      console.error("[Terminal] PTY 创建失败:", error);
      return { success: false, error: (error as Error).message };
    }
  });

  // 写入数据到 PTY
  ipcMain.handle("terminal:write", async (_event, id: string, data: string) => {
    try {
      const session = sessions.get(id);
      if (!session || !session.pty) {
        return { success: false, error: `会话不存在: ${id}` };
      }

      session.pty.write(data);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 调整 PTY 大小
  ipcMain.handle("terminal:resize", async (_event, id: string, cols: number, rows: number) => {
    try {
      const session = sessions.get(id);
      if (!session || !session.pty) {
        return { success: false, error: `会话不存在: ${id}` };
      }

      session.pty.resize(cols, rows);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 关闭 PTY 会话
  ipcMain.handle("terminal:close", async (_event, id: string) => {
    try {
      const session = sessions.get(id);
      if (!session) {
        return { success: false, error: `会话不存在: ${id}` };
      }

      if (session.pty) {
        session.pty.kill();
      }
      sessions.delete(id);
      console.log(`[Terminal] PTY 会话已关闭: ${id}`);
      return { success: true };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // ========== 以下是原有的回退模式（node-pty 不可用时使用） ==========

  // 执行命令（带安全检查）
  ipcMain.handle("terminal:execute", async (_event, command: string, cwd?: string) => {
    try {
      const safetyCheck = isCommandSafe(command);
      if (!safetyCheck.safe) {
        return {
          success: false,
          error: safetyCheck.reason,
          data: { stdout: "", stderr: safetyCheck.reason || "Command blocked" },
        };
      }

      const options: { cwd?: string; shell?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {
        timeout: COMMAND_TIMEOUT_MS,
        env: { ...process.env },
      };

      if (cwd && fs.existsSync(cwd)) {
        options.cwd = cwd;
      }

      options.shell = process.platform === "win32" ? "cmd.exe" : "/bin/bash";

      const { stdout, stderr } = await execAsync(command, options);
      return { success: true, data: { stdout, stderr } };
    } catch (error: unknown) {
      const err = error as Error & { stdout?: string; stderr?: string };
      return {
        success: false,
        error: err.message,
        data: { stdout: err.stdout || "", stderr: err.stderr || err.message },
      };
    }
  });

  // 切换目录
  ipcMain.handle("terminal:cd", async (_event, currentDir: string, newDir: string) => {
    try {
      let targetPath: string;

      if (path.isAbsolute(newDir)) {
        targetPath = newDir;
      } else if (newDir === "~" || newDir === "%USERPROFILE%") {
        targetPath = process.env.HOME || process.env.USERPROFILE || "";
      } else if (newDir === "-") {
        targetPath = currentDir;
      } else {
        targetPath = path.resolve(currentDir, newDir);
      }

      if (!fs.existsSync(targetPath)) {
        return { success: false, error: `Directory not found: ${newDir}` };
      }

      const stat = fs.statSync(targetPath);
      if (!stat.isDirectory()) {
        return { success: false, error: `Not a directory: ${newDir}` };
      }

      return { success: true, data: targetPath };
    } catch (error: unknown) {
      return { success: false, error: (error as Error).message };
    }
  });

  // 获取当前工作目录
  ipcMain.handle("terminal:pwd", async () => {
    return { success: true, data: process.cwd() };
  });
}
